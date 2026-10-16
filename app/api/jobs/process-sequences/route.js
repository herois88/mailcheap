import { NextResponse } from "next/server";
import { withQStashSignature } from "@/lib/qstash-route";
import SequenceEnrollment from "@/models/SequenceEnrollment";
import Sequence from "@/models/Sequence";
import Contact from "@/models/Contact";
import Newsletter from "@/models/Newsletter";
import Message from "@/models/Message";
import { connectDb } from "@/lib/db";
import { sendMessageBatch } from "@/lib/sending";
import { mailboxProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handleProcess() {
	await connectDb();
	const now = new Date();
	const due = await SequenceEnrollment.find({ status: "active", nextSendAt: { $lte: now } }).limit(20).lean();

	const results = [];
	for (const enrollment of due) {
		const [sequence, contact, newsletter] = await Promise.all([
			Sequence.findById(enrollment.sequenceId).lean(),
			Contact.findById(enrollment.contactId).lean(),
			Newsletter.findById(enrollment.newsletterId).lean(),
		]);

		if (!sequence || !contact || contact.status !== "active" || !newsletter) {
			await SequenceEnrollment.updateOne({ _id: enrollment._id }, { status: "cancelled" });
			results.push({ id: String(enrollment._id), skipped: "invalid" });
			continue;
		}

		const step = sequence.steps?.[enrollment.currentStep];
		if (!step?.subject) {
			await SequenceEnrollment.updateOne({ _id: enrollment._id }, { status: "completed" });
			results.push({ id: String(enrollment._id), done: true });
			continue;
		}

		try {
			const message = await Message.create({
				kind: "welcome",
				accountId: newsletter.accountId,
				newsletterId: newsletter._id,
				contactId: contact._id,
				email: contact.email,
				provider: mailboxProvider(contact.email),
			});

			await sendMessageBatch({
				accountId: String(newsletter.accountId),
				messageIds: [String(message._id)],
			});

			console.info(`[sequence] step ${enrollment.currentStep} "${step.subject}" → ${contact.email}`);
		} catch (err) {
			console.error(`[sequence] failed ${enrollment._id}:`, err.message);
			results.push({ id: String(enrollment._id), error: err.message });
			continue;
		}

		const nextIndex = enrollment.currentStep + 1;
		if (nextIndex >= (sequence.steps?.length || 0)) {
			await SequenceEnrollment.updateOne({ _id: enrollment._id }, { status: "completed", currentStep: nextIndex });
		} else {
			const delay = sequence.steps[nextIndex].delayDays || 0;
			const nextSendAt = new Date(now.getTime() + delay * 86400000);
			await SequenceEnrollment.updateOne({ _id: enrollment._id }, { currentStep: nextIndex, nextSendAt });
		}
		results.push({ id: String(enrollment._id), sent: enrollment.currentStep });
	}

	return NextResponse.json({ processed: results.length, results });
}

export const POST = withQStashSignature(handleProcess);
