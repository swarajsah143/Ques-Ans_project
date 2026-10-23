import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";
const modelTimeoutMs = 20 * 60_000;
function writeEvent(response, event) {
    if (!response.destroyed)
        response.write(`${JSON.stringify(event)}\n`);
}
export function streamModelAnswer(question, temperature, request, response) {
    response.status(200).set({
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
    });
    response.flushHeaders();
    response.write(`${JSON.stringify({ type: "meta", temperature })}\n`);
    const projectRoot = path.resolve(process.env.APP_ROOT || process.cwd());
    const modelScript = path.join(projectRoot, "GenAI", "stream-test.py");
    const child = spawn(process.env.PYTHON_EXECUTABLE || "python3", [modelScript], { cwd: projectRoot, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    let hasText = false;
    let finished = false;
    const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        finish({
            type: "error",
            error: "The local model took too long to respond. Check that Ollama is running and try again.",
        });
    }, modelTimeoutMs);
    function finish(event) {
        if (finished)
            return;
        finished = true;
        clearTimeout(timeout);
        if (event)
            writeEvent(response, event);
        if (!response.destroyed)
            response.end();
    }
    request.on("aborted", () => {
        if (!finished) {
            finished = true;
            clearTimeout(timeout);
            child.kill("SIGTERM");
        }
    });
    response.on("close", () => {
        if (!response.writableEnded && !finished) {
            finished = true;
            clearTimeout(timeout);
            child.kill("SIGTERM");
        }
    });
    child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-4000);
    });
    const output = createInterface({ input: child.stdout });
    output.on("line", (line) => {
        if (finished || !line.trim())
            return;
        try {
            const part = JSON.parse(line);
            if (typeof part.text !== "string")
                throw new Error("Invalid model output.");
            if (part.text) {
                hasText = true;
                writeEvent(response, { type: "chunk", text: part.text });
            }
        }
        catch {
            child.kill("SIGTERM");
            finish({ type: "error", error: "The local model returned an invalid response." });
        }
    });
    child.on("error", error => {
        const message = "code" in error && error.code === "ENOENT"
            ? "Python was not found. Set PYTHON_EXECUTABLE to the interpreter with Ollama installed."
            : "Could not start the local model. Check your Python and Ollama setup.";
        finish({ type: "error", error: message });
    });
    child.on("close", code => {
        if (finished)
            return;
        if (code === 0 && hasText) {
            finish({ type: "done" });
            return;
        }
        if (code === 0) {
            finish({ type: "error", error: "The local model returned an empty answer." });
            return;
        }
        console.error("Local model process failed:", stderr || `exit code ${code}`);
        finish({
            type: "error",
            error: "The local model could not generate an answer. Check that Ollama is running and gemma3:1b is installed.",
        });
    });
    child.stdin.on("error", () => {
        child.kill("SIGTERM");
        finish({ type: "error", error: "Could not send the question to the local model." });
    });
    child.stdin.end(`${JSON.stringify({ question, temperature })}\n`);
}
