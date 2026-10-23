export function calculateTemperature(question) {
    const text = question.toLowerCase();
    const factualSignals = /\b(what is|who is|when did|where is|define|calculate|solve|how many|how much|formula|fact|source|explain)\b/.test(text);
    const creativeSignals = /\b(write|story|poem|brainstorm|imagine|invent|creative|joke| lyrics|design)\b/.test(text);
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    let temperature = 0.55;
    if (factualSignals)
        temperature -= 0.2;
    if (creativeSignals)
        temperature += 0.23;
    if (words > 30)
        temperature -= 0.05;
    return Math.min(0.9, Math.max(0.15, Math.round(temperature * 100) / 100));
}
