import express from "express";
import path from "node:path";
import { calculateTemperature } from "./temperature.js";
import { streamModelAnswer } from "./model.js";
const maxQuestionLength = 4000;
export function createApp() {
    const app = express();
    const projectRoot = path.resolve(process.env.APP_ROOT || process.cwd());
    const clientBuild = path.join(projectRoot, "dist");
    app.disable("x-powered-by");
    app.use(express.json({ limit: "16kb" }));
    app.post("/api/answer", (request, response, next) => {
        const question = request.body?.question;
        if (typeof question !== "string" || !question.trim()) {
            response.status(400).json({ error: "Enter a question before submitting." });
            return;
        }
        if (question.trim().length > maxQuestionLength) {
            response.status(413).json({ error: "Questions must be 4,000 characters or fewer." });
            return;
        }
        try {
            const normalizedQuestion = question.trim();
            streamModelAnswer(normalizedQuestion, calculateTemperature(normalizedQuestion), request, response);
        }
        catch (error) {
            next(error);
        }
    });
    app.use(express.static(clientBuild, { index: "index.html" }));
    app.use((_request, response) => {
        response.status(404).json({ error: "Page not found." });
    });
    const handleError = (error, _request, response, _next) => {
        if (response.headersSent) {
            response.end();
            return;
        }
        if (error instanceof SyntaxError) {
            response.status(400).json({ error: "Request body must be valid JSON." });
            return;
        }
        if (error instanceof Error && "status" in error && error.status === 413) {
            response.status(413).json({ error: "Question is too large." });
            return;
        }
        console.error("Request failed:", error);
        response.status(500).json({ error: "An unexpected server error occurred." });
    };
    app.use(handleError);
    return app;
}
