import mongoose from "mongoose";
import { accountScoped } from "../lib/account-scope.js";

const enrollmentSchema = new mongoose.Schema(
	{
		sequenceId: { type: mongoose.Schema.Types.ObjectId, ref: "Sequence", required: true },
		newsletterId: { type: mongoose.Schema.Types.ObjectId, ref: "Newsletter", required: true },
		contactId: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", required: true },
		currentStep: { type: Number, default: 0 },
		nextSendAt: { type: Date },
		status: { type: String, enum: ["active", "completed", "paused", "cancelled"], default: "active" },
	},
	{ timestamps: true }
);

enrollmentSchema.plugin(accountScoped);
enrollmentSchema.index({ newsletterId: 1, contactId: 1, sequenceId: 1 }, { unique: true });
enrollmentSchema.index({ status: 1, nextSendAt: 1 });

export default mongoose.models.SequenceEnrollment || mongoose.model("SequenceEnrollment", enrollmentSchema);
