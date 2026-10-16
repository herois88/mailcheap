import { connectDb } from "@/lib/db";
import Sequence from "@/models/Sequence";
import Newsletter from "@/models/Newsletter";
import { getAccount } from "@/lib/auth";
import { notFound } from "next/navigation";

export default async function SequencesPage({ params }) {
	const { slug } = await params;
	const account = await getAccount();
	await connectDb();

	const newsletter = await Newsletter.findOne({ accountId: account._id, slug }).lean();
	if (!newsletter) notFound();

	const sequences = await Sequence.find({ accountId: account._id, newsletterId: newsletter._id }).lean();

	return (
		<div className="p-6 max-w-3xl">
			<h1 className="text-2xl font-semibold mb-4">Sequências — {newsletter.name}</h1>
			<p className="text-sm text-muted-foreground mb-6">
				Sequências automáticas para novos subscritores (welcome + follow-ups).
			</p>

			{sequences.length === 0 ? (
				<p className="text-sm">Ainda não tens sequências. Cria uma na base de dados ou via API por agora.</p>
			) : (
				<ul className="space-y-3">
					{sequences.map((seq) => (
						<li key={seq._id} className="border rounded p-4">
							<div className="font-medium">{seq.name}</div>
							<div className="text-sm text-muted-foreground">
								{seq.steps?.length || 0} passos · {seq.enabled ? "Ativa" : "Inativa"}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
