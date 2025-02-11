import OpenAI from "openai";

export async function llm(
	//systemPrompt: string,
	userPrompt: string,
	apiKey: string,
	onToken: (partialResponse: string, done: boolean) => void,
) {
	if (!apiKey) {
		throw new Error("No API key found")
	}
	//console.log("System Prompt:", systemPrompt);
	//console.log("User Prompt:", userPrompt);
	let partial = "";
	const openai = new OpenAI({
		apiKey,
		dangerouslyAllowBrowser: true,
	});
	const stream = await openai.chat.completions.create({
		model: "gpt-4o",
		messages: [
			{ role: "system", content: 'You are a helpful assistant.' },
			{ role: "user", content: userPrompt },
		],
		stream: true,
	});
	for await (const chunk of stream) {
		partial += chunk.choices[0]?.delta?.content || "";
		onToken(partial, false);
	}
	console.log("Generated:", partial);
	onToken(partial, true);
}