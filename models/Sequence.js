import mongoose from "mongoose";
import { accountScoped } from "../lib/account-scope.js";

const sequenceStepSchema = new mongoose.Schema(
	{
		delayDays: { type: Number, required: true, min: 0 },
		subject: { type: String, required: true, trim: true },
		previewText: { type: String, trim: true },
		markdown: { type: String },
		html: { type: String },
	},
	{ _id: false }
);

const sequenceSchema = new mongoose.Schema(
	{
		newsletterId: { type: mongoose.Schema.Types.ObjectId, ref: "Newsletter", required: true },
		name: { type: String, required: true, trim: true },
		enabled: { type: Boolean, default: true },
		trigger: { type: String, enum: ["new_subscriber"], default: "new_subscriber" },
		steps: [sequenceStepSchema],
	},
	{ timestamps: true }
);

sequenceSchema.plugin(accountScoped);
sequenceSchema.index({ newsletterId: 1, enabled: 1 });

export default mongoose.models.Sequence || mongoose.model("Sequence", sequenceSchema);
