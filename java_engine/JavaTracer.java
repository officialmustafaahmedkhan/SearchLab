import com.sun.jdi.*;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;

import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * JavaTracer - Automatic step tracer for SearchLab.
 *
 * Launches a compiled Java program under the JDK's built-in Java Debug
 * Interface (JDI), records one record per executed source line of the target
 * class (line number, method, visible local variables and the call stack) and
 * writes them as a JSON array to the output file.
 *
 * Usage:
 *   java JavaTracer <targetClass> <classpath> <outputFile> [programArgs...]
 *
 * This is genuine instrumented execution: no source rewriting and no external
 * dependencies are required, only a JDK (javac + java).
 *
 * Note: the Java launcher prepares the main class *before* VMStartEvent is
 * delivered, so a ClassPrepareRequest never fires for it. We therefore
 * bootstrap stepping from a MethodEntryRequest on the target class instead,
 * falling back to ClassPrepareRequest for any other target classes.
 */
public class JavaTracer {

    private static final int MAX_EVENTS = 20000;

    public static void main(String[] argv) throws Exception {
        if (argv.length < 3) {
            System.err.println("Usage: JavaTracer <targetClass> <classpath> <outputFile> [args...]");
            System.exit(2);
        }

        String targetClass = argv[0];
        String classPath = argv[1];
        String outputFile = argv[2];
        List<String> programArgs = new ArrayList<>();
        for (int i = 3; i < argv.length; i++) {
            programArgs.add(argv[i]);
        }

        List<String> records = new ArrayList<>();

        VirtualMachineManager vmm = Bootstrap.virtualMachineManager();
        LaunchingConnector connector = vmm.defaultConnector();
        Map<String, Connector.Argument> args = connector.defaultArguments();

        String mainValue = programArgs.isEmpty()
                ? targetClass
                : targetClass + " " + String.join(" ", programArgs);
        args.get("main").setValue(mainValue);

        // Extra VM options (e.g. -Dsearchlab.events=...) are supplied by the
        // engine via the SEARCHLAB_VM_OPTS environment variable.
        String vmOpts = System.getenv("SEARCHLAB_VM_OPTS");
        StringBuilder options = new StringBuilder();
        if (vmOpts != null && !vmOpts.isEmpty()) {
            options.append(vmOpts).append(' ');
        }
        if (classPath != null && !classPath.isEmpty()) {
            options.append("-classpath \"").append(classPath).append('"');
        }
        args.get("options").setValue(options.toString());

        VirtualMachine vm = connector.launch(args);
        EventRequestManager erm = vm.eventRequestManager();

        // Fires for target classes that are NOT the pre-loaded main class.
        ClassPrepareRequest classPrepare = erm.createClassPrepareRequest();
        classPrepare.addClassFilter(targetClass);
        classPrepare.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        classPrepare.enable();

        // Bootstraps stepping for the (already prepared) main class.
        MethodEntryRequest methodEntry = erm.createMethodEntryRequest();
        methodEntry.addClassFilter(targetClass);
        methodEntry.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        methodEntry.enable();

        Set<ThreadReference> steppingThreads = Collections.newSetFromMap(new IdentityHashMap<>());

        boolean connected = true;
        EventQueue queue = vm.eventQueue();

        while (connected) {
            EventSet eventSet;
            try {
                eventSet = queue.remove();
            } catch (InterruptedException ie) {
                break;
            }

            EventIterator it = eventSet.eventIterator();
            while (it.hasNext()) {
                Event event = it.nextEvent();

                if (event instanceof ClassPrepareEvent) {
                    startStepping(erm, ((ClassPrepareEvent) event).thread(), targetClass, steppingThreads);
                } else if (event instanceof MethodEntryEvent) {
                    startStepping(erm, ((MethodEntryEvent) event).thread(), targetClass, steppingThreads);
                } else if (event instanceof StepEvent) {
                    StepEvent se = (StepEvent) event;
                    if (records.size() >= MAX_EVENTS) {
                        connected = false;
                        break;
                    }
                    records.add(recordStep(se.thread(), se.location()));
                } else if (event instanceof VMDeathEvent || event instanceof VMDisconnectEvent) {
                    connected = false;
                }
            }

            if (connected) {
                try {
                    eventSet.resume();
                } catch (VMDisconnectedException vmde) {
                    connected = false;
                }
            }
        }

        try (PrintWriter w = new PrintWriter(outputFile, StandardCharsets.UTF_8)) {
            w.print("[");
            for (int i = 0; i < records.size(); i++) {
                if (i > 0) w.print(",");
                w.print(records.get(i));
            }
            w.print("]");
        }
        System.exit(0);
    }

    /** Create a per-thread STEP_LINE/STEP_INTO request bounded to the target class. */
    private static void startStepping(EventRequestManager erm, ThreadReference thread,
                                      String targetClass, Set<ThreadReference> alreadyStepping) {
        if (thread == null || alreadyStepping.contains(thread)) {
            return;
        }
        StepRequest step = erm.createStepRequest(thread, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
        step.addClassFilter(targetClass);
        step.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        step.enable();
        alreadyStepping.add(thread);
    }

    private static String recordStep(ThreadReference thread, Location loc) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\"line\":").append(loc.lineNumber());
        sb.append(",\"method\":").append(jsonStr(loc.method().name()));
        sb.append(",\"class\":").append(jsonStr(loc.declaringType().name()));

        // Visible local variables (requires javac -g).
        sb.append(",\"locals\":{");
        try {
            StackFrame frame = thread.frame(0);
            List<LocalVariable> vars = frame.visibleVariables();
            Map<LocalVariable, Value> values = frame.getValues(vars);
            boolean first = true;
            for (Map.Entry<LocalVariable, Value> e : values.entrySet()) {
                if (!first) sb.append(",");
                first = false;
                String name = e.getKey().name();
                sb.append(jsonStr(name)).append(":")
                        .append(valueToJson(e.getValue(), thread, name));
            }
        } catch (AbsentInformationException aie) {
            // Compiled without debug info; locals simply unavailable.
        } catch (Exception ignore) {
            // Use whatever we have.
        }
        sb.append("}");

        // Call stack (innermost first).
        sb.append(",\"stack\":[");
        try {
            List<StackFrame> frames = thread.frames();
            for (int i = 0; i < frames.size() && i < 20; i++) {
                StackFrame f = frames.get(i);
                if (i > 0) sb.append(",");
                sb.append("{\"method\":").append(jsonStr(f.location().method().name()))
                        .append(",\"line\":").append(f.location().lineNumber())
                        .append(",\"class\":").append(jsonStr(f.location().declaringType().name()))
                        .append("}");
            }
        } catch (Exception ignore) {
        }
        sb.append("]}");
        return sb.toString();
    }

    private static String valueToJson(Value v) {
        return valueToJson(v, null, null);
    }

    /**
     * Locals whose *contents* are worth extracting for automatic graph
     * visualisation. Collections under these names are rendered with their
     * elements (via {@code toString()}) instead of an opaque
     * {@code "instance of ..."} so the engine can highlight visited nodes,
     * the frontier and the discovered path of a student's own search code.
     */
    private static final Set<String> GRAPH_STATE_NAMES = new HashSet<>(Arrays.asList(
            "visited", "explored", "seen", "closed", "discovered", "settled",
            "frontier", "queue", "open", "openset", "open_set", "agenda", "stack",
            "path", "route", "solution", "result", "shortestpath", "shortest_path",
            "parent", "parents", "prev", "previous", "camefrom", "came_from",
            "node", "current", "currentnode", "current_node", "curr", "u", "vertex",
            "city", "state"));

    private static String valueToJson(Value v, ThreadReference thread, String name) {
        if (v == null) return "null";
        if (v instanceof StringReference) return jsonStr(((StringReference) v).value());
        if (v instanceof IntegerValue) return String.valueOf(((IntegerValue) v).value());
        if (v instanceof LongValue) return String.valueOf(((LongValue) v).value());
        if (v instanceof ShortValue) return String.valueOf(((ShortValue) v).value());
        if (v instanceof ByteValue) return String.valueOf(((ByteValue) v).value());
        if (v instanceof DoubleValue) return String.valueOf(((DoubleValue) v).value());
        if (v instanceof FloatValue) return String.valueOf(((FloatValue) v).value());
        if (v instanceof BooleanValue) return String.valueOf(((BooleanValue) v).value());
        if (v instanceof CharValue) return jsonStr(String.valueOf(((CharValue) v).value()));
        if (v instanceof ArrayReference) {
            ArrayReference arr = (ArrayReference) v;
            StringBuilder sb = new StringBuilder("[");
            List<Value> vals = arr.getValues();
            int n = Math.min(vals.size(), 500);
            for (int i = 0; i < n; i++) {
                if (i > 0) sb.append(",");
                sb.append(valueToJson(vals.get(i)));
            }
            sb.append("]");
            return sb.toString();
        }
        if (v instanceof ObjectReference) {
            ObjectReference o = (ObjectReference) v;
            if (thread != null && name != null
                    && GRAPH_STATE_NAMES.contains(name.toLowerCase(Locale.ROOT))) {
                String rendered = renderCollection(thread, o);
                if (rendered != null) {
                    return jsonStr(rendered);
                }
            }
            return jsonStr("instance of " + o.referenceType().name());
        }
        return jsonStr(String.valueOf(v));
    }

    /**
     * Best-effort {@code toString()} of a suspended object.
     *
     * Method invocation only works while the owning thread is suspended, and it
     * can fail for exotic types, so every failure is swallowed and the caller
     * falls back to the opaque representation.
     */
    private static String renderCollection(ThreadReference thread, ObjectReference o) {
        try {
            Method toString = null;
            for (Method m : o.referenceType().methodsByName("toString", "()Ljava/lang/String;")) {
                toString = m;
                break;
            }
            if (toString == null) {
                return null;
            }
            Value result = o.invokeMethod(thread, toString, Collections.emptyList(),
                    ObjectReference.INVOKE_SINGLE_THREADED);
            if (result instanceof StringReference) {
                String text = ((StringReference) result).value();
                return truncate(text, 4000);
            }
        } catch (Exception ignore) {
            // Invocation not supported for this object; fall back to opaque form.
        }
        return null;
    }

    private static String truncate(String s, int max) {
        if (s == null || s.length() <= max) {
            return s;
        }
        return s.substring(0, max);
    }

    private static String jsonStr(String s) {
        if (s == null) return "null";
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        sb.append("\"");
        return sb.toString();
    }
}
