import { createClient } from "@/app/utils/supabase/server";
import { format } from "date-fns";
import { cookies } from "next/headers";

export default async function Dashboard() {
	const cookieStore = cookies();
	const supabase = createClient(cookieStore);

	const { data: transactions, error } = await supabase
		.from("transactions")
		.select(`*, categories (name)`)
		.order("date", { ascending: false })
		.limit(20);

	if (error) {
		console.error("Error fetching transactions:", error);
	} else if (!transactions || transactions.length === 0) {
		console.log("No transactions found. Check RLS policies.");
	}

	return (
		<main className="min-h-screen bg-gray-50 p-8">
			<div className="max-w-4xl mx-auto">
				<div className="flex justify-between items-center mb-6">
					<h1 className="text-2xl font-bold text-gray-900">
						Finance Dashboard
					</h1>
					<button className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition">
						+ Connect Bank
					</button>
				</div>

				{/* Stats Cards Row */}
				<div className="grid grid-cols-3 gap-4 mb-8">
					<div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
						<h3 className="text-gray-500 text-sm font-medium">Last Month</h3>
						<p className="text-gray-500 text-2xl font-bold mt-2">R$ 3.639,12</p>
					</div>
					{/* Add more cards here later */}
				</div>

				{/* Transactions Table */}
				<div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
					<div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
						<h2 className="font-semibold text-gray-700">Recent Activity</h2>
					</div>

					<div className="divide-y divide-gray-100">
						{transactions?.map((tx) => (
							<div
								key={tx.id}
								className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
							>
								<div className="flex items-center gap-4">
									<div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
										{/* Accessing the joined category name safely */}
										{tx.categories?.name?.substring(0, 2).toUpperCase() || "NA"}
									</div>
									<div>
										<p className="font-medium text-gray-900">
											{tx.description}
										</p>
										<p className="text-sm text-gray-500">
											{format(new Date(tx.date), "dd MMM yyyy")} •{" "}
											{tx.categories?.name}
										</p>
									</div>
								</div>
								<div className="text-right">
									<p className="font-bold text-gray-900">
										- R${" "}
										{Number(tx.amount).toLocaleString("pt-BR", {
											minimumFractionDigits: 2,
										})}
									</p>
									{tx.total_installments > 1 && (
										<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
											{tx.total_installments} parcelas de R${" "}
											{tx.amount.toLocaleString("pt-BR", {
												minimumFractionDigits: 2,
											})}
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</main>
	);
}
