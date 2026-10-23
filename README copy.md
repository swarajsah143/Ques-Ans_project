# Stillwater
<!-- just run "run.sh" file -->
Stillwater is a React + TypeScript question-and-answer app. Its Express API sends questions to the local `gemma3:1b` Ollama model through `GenAI/stream-test.py` and streams generated text back to the browser.

## Requirements

- Node.js 20.12 or newer
- Python 3
- [Ollama](https://ollama.com/download), running locally with `gemma3:1b` installed

Install the model and Python package:

```sh
ollama pull gemma3:1b
python3 -m pip install -r GenAI/requirements.txt
```

## Development

On macOS, you can start the required services and the app with one command:

```sh
./run.sh
```

The launcher checks the Python and Node dependencies, starts Ollama if needed, downloads `gemma3:1b` if it is missing, and then starts the frontend and API together. Press `Ctrl+C` to stop the app.

Alternatively, start the services manually:

```sh
npm install
npm run dev
```

Open the Vite URL printed in the terminal (usually <http://127.0.0.1:5173>). Vite proxies `/api` requests to the Express server on port 3001.

If the Python environment containing `ollama` is not on your default `python3`, set `PYTHON_EXECUTABLE` to its full interpreter path before starting the dev server.

## Production build

```sh
npm run build
npm start
```

The Express server serves the built frontend and API from port 3001 by default. Set `PORT` or `HOST` to change its bind address. No Gemini or OpenAI API key is used.

Short factual questions remain concise. Explanation requests use more output space, and prompts with an explicit word count (for example, `Explain this in 10,000 words`) receive a matching generation budget, up to 10,000 requested words. Gemma 3 is configured with a larger context for those long answers; they can take a long time to finish.

## Tests

```sh
npm test
```
