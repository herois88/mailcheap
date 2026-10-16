import Sequence from "@/models/Sequence";
import SequenceEnrollment from "@/models/SequenceEnrollment";
import { connectDb } from "@/lib/db";

export async function enrollContactInSequences({ accountId, newsletterId, contactId }) {
	await connectDb();
	const sequences = await Sequence.find({ accountId, newsletterId, enabled: true, trigger: "new_subscriber" }).lean();
	if (!sequences.length) return { enrolled: 0 };

	const now = new Date();
	const enrollments = [];

	for (const seq of sequences) {
		if (!seq.steps?.length) continue;
		const firstDelayMs = (seq.steps[0].delayDays || 0) * 24 * 60 * 60 * 1000;
		const nextSendAt = new Date(now.getTime() + firstDelayMs);

		enrollments.push({
			accountId,
			sequenceId: seq._id,
			newsletterId,
			contactId,
			currentStep: 0,
			nextSendAt,
			status: "active",
		});
	}

	if (enrollments.length) {
		await SequenceEnrollment.insertMany(enrollments, { ordered: false }).catch(() => {});
	}

	return { enrolled: enrollments.length };
}
