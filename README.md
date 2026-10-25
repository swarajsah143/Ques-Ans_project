# Stillwater

Stillwater is a React and TypeScript question-and-answer app powered by a local
Gemma model through Ollama. Questions asking for current information are searched
with Tavily, and the answer includes links to the web sources.

## Requirements

- Node.js 20.12 or newer
- Python 3
- [Ollama](https://ollama.com/download), with `gemma3:1b` installed
- A Tavily API key for questions that need current information

Set your Tavily key in the environment before starting the app:

```sh
export TAVILY_API_KEY="your-tavily-api-key"
./run.sh
```

The key is only used by the server for current-information searches. Questions
that do not appear to need current information continue to use the local model
without a web search. Do not commit the API key to the repository.

The launcher starts Ollama if needed, downloads the model if missing, and starts
the frontend and API. For manual setup, install the Python dependencies with
`python3 -m pip install -r GenAI/requirements.txt`, then run `npm install` and
`npm run dev`.

## Build and tests

```sh
npm run build
npm test
```
