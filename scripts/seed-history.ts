import pdf from "@cedrugs/pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
	console.error(
		"Missing required environment variables. Check .env.local file."
	);
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

async function extractTextFromPDF(filePath: string): Promise<string> {
	const dataBuffer = readFileSync(filePath);
	const data = await pdf(dataBuffer);
	return data.text;
}

async function parseWithGemini(rawText: string, fileName: string) {
	console.log(`Asking Gemini to analyze file: ${fileName}`);

	const prompt = `
    You are a financial data parser. 
    Analyze the following text from a Brazilian Credit Card Bill (Bradesco).
    
    Extract ALL transactions. Return ONLY a JSON array. Do not include markdown formatting like \`\`\`json.
    
    The JSON objects must have this exact schema:
    {
      "date": "YYYY-MM-DD", (Use the bill year found in text, usually 2025. If date is 15/09, result is 2025-09-15)
      "description": "string", (Cleaned name, e.g., "UBER TRIP" instead of "UBER TRIP HELP.UBER.COM")
      "amount": number, (Positive float. Convert "1.234,56" to 1234.56)
      "category_guess": "string", (Guess the category: Groceries, Transport, Electronics, Health, Nightlife, Food Delivery, Services, Other)
      "installment_current": number, (1 if single purchase. If '02/10', then 2)
      "installment_total": number (1 if single purchase. If '02/10', then 10)
    }

    Raw Text:
    ${rawText.slice(
			0,
			30000
		)} // Limiting text length to avoid token limits just in case
  `;

	const result = await model.generateContent(prompt);
	const response = await result.response;
	const text = response.text();

	const jsonString = text.replace(/```json|```/g, "");

	try {
		return JSON.parse(jsonString);
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (error) {
		console.error("Failed to parse JSON from Gemini response:", text);
		return [];
	}
}

async function processFiles() {
	const documentsDir = path.join(process.cwd(), "documents");
	const files = readdirSync(documentsDir).filter((file) =>
		file.endsWith(".pdf")
	);

	console.log(`Found ${files.length} PDF files to process.`);

	for (const file of files) {
		const filePath = path.join(documentsDir, file);
		console.log(`Processing file: ${file}`);

		const rawText = await extractTextFromPDF(filePath);
		const transactions = await parseWithGemini(rawText, file);

		console.log(`Extracted ${transactions.length} transactions from ${file}.`);

		for (const transaction of transactions) {
			let categoryId;
			const { data: catData } = await supabase
				.from("categories")
				.select("id")
				.eq("name", transaction.category_guess)
				.single();

			if (catData) {
				categoryId = catData.id;
				console.log(`Found existing category: ${transaction.category_guess}.`);
			} else {
				const { data: newCatData } = await supabase
					.from("categories")
					.insert({ name: transaction.category_guess })
					.select()
					.single();

				categoryId = newCatData?.id;
				console.log(`Created new category: ${transaction.category_guess}`);
			}

			const { data: insertedTransaction, error } = await supabase
				.from("transactions")
				.insert({
					description: transaction.description,
					amount: transaction.amount,
					date: transaction.date,
					category_id: categoryId,
					total_installments: transaction.installment_total,
				})
				.select()
				.single();
			console.log(
				`Inserted transaction: ${transaction.description} on ${transaction.date}`
			);

			if (error) {
				console.error("Error inserting transaction. Details: ", error.message);
				continue;
			}

			await supabase.from("installments").insert({
				transaction_id: insertedTransaction?.id,
				installment_number: transaction.installment_current,
				amount: transaction.amount / transaction.installment_total,
				due_date: transaction.date,
				status: "PAID",
			});
			console.log(
				`Inserted installment ${transaction.installment_current} of ${transaction.installment_total} for transaction: ${transaction.description} on ${transaction.date}`
			);
		}
	}

	console.log("All files processed.");
}

processFiles();
