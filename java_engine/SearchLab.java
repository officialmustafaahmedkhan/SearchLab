import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * SearchLab Java runtime.
 *
 * Bundled with the engine and placed on the classpath alongside the user's
 * program. It provides two things:
 *
 *   1. {@link #loadInput(String[])} - parses the JSON input document the engine
 *      writes to a temp file and passes as the first program argument, so Java
 *      algorithms receive the same graph/array input as the Python engine.
 *
 *   2. {@link #viz} - a visualizer API mirroring the Python recorder
 *      (visitNode, traverseEdge, compare, swap, ...). Each call appends a JSON
 *      record to the file named by the {@code searchlab.events} system property.
 *      The engine reads those records and maps them into the app's event model.
 *
 * No external dependencies: plain JDK only.
 */
public final class SearchLab {

    private SearchLab() {}

    /** Visualizer API instance: call SearchLab.viz.visitNode("A") etc. */
    public static final Visualizer viz = new Visualizer();

    private static PrintWriter EVENT_WRITER = null;
    private static Object INPUT = null;

    static {
        String file = System.getProperty("searchlab.events");
        if (file != null && !file.isEmpty()) {
            try {
                EVENT_WRITER = new PrintWriter(
                        new FileWriter(file, StandardCharsets.UTF_8, false), true);
            } catch (IOException ignored) {
                EVENT_WRITER = null;
            }
        }
    }

    // ------------------------------------------------------------------
    // Input loading
    // ------------------------------------------------------------------

    /** Parse the JSON input file passed as args[0] (or -Dsearchlab.input). */
    public static Object loadInput(String[] args) {
        if (INPUT != null) {
            return INPUT;
        }
        String path = null;
        if (args != null && args.length > 0) {
            path = args[0];
        }
        if (path == null) {
            path = System.getProperty("searchlab.input");
        }
        if (path == null) {
            INPUT = new LinkedHashMap<String, Object>();
            return INPUT;
        }
        try {
            String text = new String(Files.readAllBytes(Paths.get(path)), StandardCharsets.UTF_8);
            INPUT = Json.parse(text);
        } catch (Exception e) {
            INPUT = new LinkedHashMap<String, Object>();
        }
        return INPUT;
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> loadInputMap(String[] args) {
        Object value = loadInput(args);
        if (value instanceof Map) {
            return (Map<String, Object>) value;
        }
        return new LinkedHashMap<String, Object>();
    }

    public static void flush() {
        if (EVENT_WRITER != null) {
            EVENT_WRITER.flush();
        }
    }

    // ------------------------------------------------------------------
    // Convenience helpers used by the default algorithm samples
    // ------------------------------------------------------------------

    /** A directed adjacency entry with a node id and an edge cost. */
    public static final class Edge {
        public final String node;
        public final double cost;

        public Edge(String node, double cost) {
            this.node = node;
            this.cost = cost;
        }
    }

    public static String start(Map<String, Object> input) {
        return (String) input.get("startNodeId");
    }

    public static String goal(Map<String, Object> input) {
        return (String) input.get("goalNodeId");
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> nodesOf(Map<String, Object> input) {
        Object value = input.get("nodes");
        return value instanceof List ? (List<Map<String, Object>>) (List<?>) value
                : new ArrayList<>();
    }

    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> edgesOf(Map<String, Object> input) {
        Object value = input.get("edges");
        return value instanceof List ? (List<Map<String, Object>>) (List<?>) value
                : new ArrayList<>();
    }

    /** Build an undirected/directed adjacency list from a graph input document. */
    public static Map<String, List<Edge>> adjacency(Map<String, Object> input) {
        Map<String, List<Edge>> adj = new LinkedHashMap<>();
        for (Map<String, Object> node : nodesOf(input)) {
            adj.put(String.valueOf(node.get("id")), new ArrayList<Edge>());
        }
        for (Map<String, Object> edge : edgesOf(input)) {
            String from = String.valueOf(edge.get("from"));
            String to = String.valueOf(edge.get("to"));
            double cost = edge.get("cost") instanceof Number
                    ? ((Number) edge.get("cost")).doubleValue() : 1.0;
            boolean directed = Boolean.TRUE.equals(edge.get("directed"));
            if (adj.containsKey(from)) {
                adj.get(from).add(new Edge(to, cost));
            }
            if (!directed && adj.containsKey(to)) {
                adj.get(to).add(new Edge(from, cost));
            }
        }
        return adj;
    }

    public static double heuristic(Map<String, Object> input, String nodeId) {
        for (Map<String, Object> node : nodesOf(input)) {
            if (nodeId.equals(String.valueOf(node.get("id")))) {
                Object h = node.get("heuristic");
                return h instanceof Number ? ((Number) h).doubleValue() : 0.0;
            }
        }
        return 0.0;
    }

    /** Convert a JSON array input into an int[]. */
    public static int[] toIntArray(Object input) {
        if (input instanceof List) {
            List<?> list = (List<?>) input;
            int[] out = new int[list.size()];
            for (int i = 0; i < list.size(); i++) {
                out[i] = ((Number) list.get(i)).intValue();
            }
            return out;
        }
        return new int[0];
    }

    /** Convert a JSON array input into a List&lt;String&gt;. */
    public static List<String> toStringList(Object input) {
        List<String> out = new ArrayList<>();
        if (input instanceof List) {
            for (Object value : (List<?>) input) {
                out.add(String.valueOf(value));
            }
        }
        return out;
    }

    // ------------------------------------------------------------------
    // Event recording
    // ------------------------------------------------------------------

    static void record(String type, String description, Map<String, Object> data) {
        if (EVENT_WRITER == null) {
            return;
        }
        StringBuilder sb = new StringBuilder();
        sb.append("{\"type\":").append(Json.quote(type));
        sb.append(",\"description\":").append(Json.quote(description));
        sb.append(",\"line\":").append(callerLine());
        sb.append(",\"data\":").append(Json.write(data));
        sb.append('}');
        EVENT_WRITER.println(sb.toString());
        EVENT_WRITER.flush();
    }

    private static int callerLine() {
        StackTraceElement[] stack = new Throwable().getStackTrace();
        for (StackTraceElement frame : stack) {
            String name = frame.getClassName();
            if (!name.equals("SearchLab") && !name.equals("SearchLab$Visualizer")) {
                return frame.getLineNumber();
            }
        }
        return -1;
    }

    private static Map<String, Object> data(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            map.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
        }
        return map;
    }

    private static List<Integer> box(int[] a) {
        List<Integer> out = new ArrayList<>(a.length);
        for (int v : a) {
            out.add(v);
        }
        return out;
    }

    // ------------------------------------------------------------------
    // Visualizer API
    // ------------------------------------------------------------------

    public static final class Visualizer {

        // --- Sorting & array operations ---

        public boolean compare(int[] a, int i, int j) {
            int va = a[i];
            int vb = a[j];
            record("ARRAY_COMPARED",
                    "Compared index " + i + " (" + va + ") and index " + j + " (" + vb + ")",
                    data("i", i, "j", j, "valA", va, "valB", vb, "array", box(a)));
            return va > vb;
        }

        public void swap(int[] a, int i, int j) {
            int tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
            record("ARRAY_SWAPPED",
                    "Swapped elements at index " + i + " and " + j,
                    data("i", i, "j", j, "array", box(a)));
        }

        public void write(int[] a, int index, int value) {
            a[index] = value;
            record("ARRAY_WRITTEN",
                    "Wrote value " + value + " to index " + index,
                    data("index", index, "value", value, "array", box(a)));
        }

        public void setPivot(int index) {
            record("ARRAY_PIVOT", "Selected pivot at index " + index, data("index", index));
        }

        public void setSubarray(int left, int right) {
            record("SUBARRAY_FOCUSED",
                    "Focusing subarray range [" + left + " ... " + right + "]",
                    data("left", left, "right", right));
        }

        /** Focus a single index (e.g. binary-search midpoint / found element). */
        public void highlight(int index) {
            record("SUBARRAY_FOCUSED", "Highlighting index " + index, data("index", index));
        }

        public void elementFound(int index, Object value) {
            record("ELEMENT_FOUND",
                    "Found element " + value + " at index " + index,
                    data("index", index, "value", value));
        }

        // --- Graph & AI search operations ---

        public void selectNode(String nodeId) {
            record("NODE_SELECTED", "Selected node \"" + nodeId + "\"", data("nodeId", nodeId));
        }

        public void visitNode(String nodeId) {
            record("NODE_EXPANDED", "Visited/Expanded node \"" + nodeId + "\"", data("nodeId", nodeId));
        }

        public void discoverNode(String nodeId, double cost) {
            record("NODE_DISCOVERED",
                    "Discovered node \"" + nodeId + "\" with cost " + cost,
                    data("nodeId", nodeId, "cost", cost));
        }

        public void discoverNode(String nodeId) {
            record("NODE_DISCOVERED", "Discovered node \"" + nodeId + "\"", data("nodeId", nodeId));
        }

        public void traverseEdge(String from, String to, double cost) {
            record("EDGE_RELAXED",
                    "Traversed edge (" + from + " -> " + to + ") with weight " + cost,
                    data("from", from, "to", to, "cost", cost));
        }

        public void traverseEdge(String from, String to) {
            record("EDGE_RELAXED", "Traversed edge (" + from + " -> " + to + ")",
                    data("from", from, "to", to));
        }

        public void updateCost(String nodeId, double cost) {
            record("COST_UPDATED",
                    "Updated best cost for node \"" + nodeId + "\" to " + cost,
                    data("nodeId", nodeId, "cost", cost));
        }

        public void updateQueue(List<?> items) {
            record("QUEUE_UPDATED", "Updated queue (" + items.size() + " items)",
                    data("items", new ArrayList<Object>(items)));
        }

        public void markPath(List<String> path, double totalCost) {
            record("GOAL_FOUND",
                    "Found path: " + String.join(" -> ", path) + " (Cost: " + totalCost + ")",
                    data("path", new ArrayList<Object>(path), "totalCost", totalCost));
        }

        public void markPath(List<String> path) {
            record("GOAL_FOUND", "Found path: " + String.join(" -> ", path),
                    data("path", new ArrayList<Object>(path)));
        }

        // --- Trees & hash tables ---

        public void visitTreeNode(Object nodeId, Object value) {
            record("TREE_VISITED", "Visited tree node " + nodeId + " (value " + value + ")",
                    data("node", String.valueOf(nodeId), "value", value));
        }

        public void insertTreeNode(Object nodeId, Object value, Object parentId) {
            record("TREE_INSERTED", "Inserted tree node " + nodeId + " (value " + value + ")",
                    data("node", String.valueOf(nodeId), "value", value, "parent", parentId));
        }

        public void hashInsert(Object key, Object bucket) {
            record("HASH_INSERTED", "Inserted key " + key + " into bucket " + bucket,
                    data("key", String.valueOf(key), "bucket", bucket));
        }

        public void hashCollision(Object key, Object bucket) {
            record("HASH_COLLISION", "Collision for key " + key + " at bucket " + bucket,
                    data("key", String.valueOf(key), "bucket", bucket));
        }

        // --- Misc ---

        public void setVariable(String name, Object value) {
            record("SET_VARIABLE", "Set variable " + name, data("name", name, "value", value));
        }

        public void log(Object message) {
            record("LOG_MESSAGE", String.valueOf(message), data("message", String.valueOf(message)));
        }

        public void complete(Object result) {
            record("ALGORITHM_COMPLETED", "Algorithm completed successfully",
                    data("result", result));
        }

        public void complete() {
            record("ALGORITHM_COMPLETED", "Algorithm completed successfully", data());
        }
    }

    // ------------------------------------------------------------------
    // Minimal JSON support (no external dependencies)
    // ------------------------------------------------------------------

    static final class Json {

        static String quote(String s) {
            if (s == null) {
                return "null";
            }
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
                        if (c < 0x20) {
                            sb.append(String.format("\\u%04x", (int) c));
                        } else {
                            sb.append(c);
                        }
                }
            }
            return sb.append('"').toString();
        }

        static String write(Object value) {
            if (value == null) {
                return "null";
            }
            if (value instanceof String || value instanceof Character) {
                return quote(String.valueOf(value));
            }
            if (value instanceof Boolean || value instanceof Number) {
                return String.valueOf(value);
            }
            if (value instanceof int[]) {
                return boxed((int[]) value);
            }
            if (value instanceof Object[]) {
                return array((Object[]) value);
            }
            if (value instanceof Map) {
                StringBuilder sb = new StringBuilder("{");
                boolean first = true;
                for (Map.Entry<?, ?> e : ((Map<?, ?>) value).entrySet()) {
                    if (!first) sb.append(',');
                    first = false;
                    sb.append(quote(String.valueOf(e.getKey()))).append(':').append(write(e.getValue()));
                }
                return sb.append('}').toString();
            }
            if (value instanceof Iterable) {
                StringBuilder sb = new StringBuilder("[");
                boolean first = true;
                for (Object item : (Iterable<?>) value) {
                    if (!first) sb.append(',');
                    first = false;
                    sb.append(write(item));
                }
                return sb.append(']').toString();
            }
            return quote(String.valueOf(value));
        }

        private static String boxed(int[] a) {
            List<Integer> list = new ArrayList<>(a.length);
            for (int v : a) {
                list.add(v);
            }
            return write(list);
        }

        private static String array(Object[] a) {
            List<Object> list = new ArrayList<>();
            for (Object v : a) {
                list.add(v);
            }
            return write(list);
        }

        static Object parse(String text) {
            Parser p = new Parser(text);
            p.skipWs();
            Object value = p.value();
            return value;
        }

        private static final class Parser {
            private final String s;
            private int i;

            Parser(String s) {
                this.s = s;
            }

            void skipWs() {
                while (i < s.length() && Character.isWhitespace(s.charAt(i))) {
                    i++;
                }
            }

            char peek() {
                return i < s.length() ? s.charAt(i) : '\0';
            }

            Object value() {
                skipWs();
                char c = peek();
                if (c == '{') return object();
                if (c == '[') return array();
                if (c == '"') return string();
                if (c == 't' || c == 'f') return bool();
                if (c == 'n') { i += 4; return null; }
                return number();
            }

            Map<String, Object> object() {
                Map<String, Object> map = new LinkedHashMap<>();
                i++; // {
                skipWs();
                if (peek() == '}') { i++; return map; }
                while (true) {
                    skipWs();
                    String key = string();
                    skipWs();
                    i++; // :
                    map.put(key, value());
                    skipWs();
                    char c = peek();
                    i++; // , or }
                    if (c == '}') break;
                }
                return map;
            }

            List<Object> array() {
                List<Object> list = new ArrayList<>();
                i++; // [
                skipWs();
                if (peek() == ']') { i++; return list; }
                while (true) {
                    list.add(value());
                    skipWs();
                    char c = peek();
                    i++; // , or ]
                    if (c == ']') break;
                }
                return list;
            }

            String string() {
                StringBuilder sb = new StringBuilder();
                i++; // opening quote
                while (i < s.length()) {
                    char c = s.charAt(i++);
                    if (c == '"') break;
                    if (c == '\\') {
                        char esc = s.charAt(i++);
                        switch (esc) {
                            case 'n': sb.append('\n'); break;
                            case 'r': sb.append('\r'); break;
                            case 't': sb.append('\t'); break;
                            case 'b': sb.append('\b'); break;
                            case 'f': sb.append('\f'); break;
                            case 'u':
                                sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
                                i += 4;
                                break;
                            default: sb.append(esc);
                        }
                    } else {
                        sb.append(c);
                    }
                }
                return sb.toString();
            }

            Boolean bool() {
                if (peek() == 't') { i += 4; return Boolean.TRUE; }
                i += 5;
                return Boolean.FALSE;
            }

            Object number() {
                int start = i;
                while (i < s.length()) {
                    char c = s.charAt(i);
                    if (c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E' || (c >= '0' && c <= '9')) {
                        i++;
                    } else {
                        break;
                    }
                }
                String token = s.substring(start, i);
                if (token.indexOf('.') >= 0 || token.indexOf('e') >= 0 || token.indexOf('E') >= 0) {
                    return Double.parseDouble(token);
                }
                return Long.parseLong(token);
            }
        }
    }
}
