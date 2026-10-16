import { NextResponse } from "next/server";
import { withQStashSignature } from "@/lib/qstash-route";
import SequenceEnrollment from "@/models/SequenceEnrollment";
import Sequence from "@/models/Sequence";
import Contact from "@/models/Contact";
import Newsletter from "@/models/Newsletter";
import { connectDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handleProcess(request) {
	await connectDb();
	const now = new Date();
	const due = await SequenceEnrollment.find({ status: "active", nextSendAt: { $lte: now } }).limit(50).lean();

	const results = [];
	for (const enrollment of due) {
		const [sequence, contact, newsletter] = await Promise.all([
			Sequence.findById(enrollment.sequenceId).lean(),
			Contact.findById(enrollment.contactId).lean(),
			Newsletter.findById(enrollment.newsletterId).lean(),
		]);

		if (!sequence || !contact || contact.status !== "active" || !newsletter) {
			await SequenceEnrollment.updateOne({ _id: enrollment._id }, { status: "cancelled" });
			results.push({ id: enrollment._id, skipped: "invalid" });
			continue;
		}

		const step = sequence.steps[enrollment.currentStep];
		if (!step) {
			await SequenceEnrollment.updateOne({ _id: enrollment._id }, { status: "completed" });
			results.push({ id: enrollment._id, done: true });
			continue;
		}

		// TODO: send the email using existing sendSignupEmail or queue path
		console.info(`[sequence] would send step ${enrollment.currentStep} of ${sequence.name} to ${contact.email}`);

		const nextIndex = enrollment.currentStep + 1;
		if (nextIndex >= sequence.steps.length) {
			await SequenceEnrollment.updateOne({ _id: enrollment._id }, { status: "completed", currentStep: nextIndex });
		} else {
			const nextDelay = sequence.steps[nextIndex].delayDays || 0;
			const nextSendAt = new Date(now.getTime() + nextDelay * 24 * 60 * 60 * 1000);
			await SequenceEnrollment.updateOne(
				{ _id: enrollment._id },
				{ currentStep: nextIndex, nextSendAt }
			);
		}
		results.push({ id: enrollment._id, sentStep: enrollment.currentStep });
	}

	return NextResponse.json({ processed: results.length, results });
}

export const POST = withQStashSignature(handleProcess);
