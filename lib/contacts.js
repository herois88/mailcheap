import crypto from "node:crypto";
import { Types } from "mongoose";
import { scoped } from "@/lib/account-scope";
import { withEngagement } from "@/lib/cleanup";
import { getAppSecret } from "@/lib/config";
import { UNDELIVERABLE_MESSAGE, findGloballySuppressed } from "@/lib/global-suppressions";
import { getSignupEmailProblem } from "@/lib/import-checks";
import { findDomainsWithoutMail } from "@/lib/mail-domains";
import Contact, { CONTACT_STATUSES } from "@/models/Contact";
import { enrollContactInSequences } from "@/lib/sequences";
import DeletedContact from "@/models/DeletedContact";
import Newsletter from "@/models/Newsletter";
import Suppression from "@/models/Suppression";

export const CONTACTS_PAGE_SIZE = 50;
const FINAL_STATUSES = ["unsubscribed", "bounced", "complained"];

// Signup forms, add_contact and MCP, for one normalized address: what to tell the person typing it, or null. A listed
// address gets the same words whichever account's email listed it, its own included.
export async function getSignupProblem(email) {
	const problem = getSignupEmailProblem(email);
	if (problem) return problem;
	if ((await findGloballySuppressed([email])).size > 0) return UNDELIVERABLE_MESSAGE;
	const withoutMail = await findDomainsWithoutMail([email.split("@")[1]]);
	return withoutMail.size > 0 ? "This email's domain can't receive email" : null;
}

// An account's newsletters in creation order with their active contacts, counted from the index in the
// same round trip.
export function listNewslettersWithActiveCounts(account, fields) {
	return Newsletter.aggregate([
		{ $match: scoped(account) },
		{ $sort: { createdAt: 1, _id: 1 } },
		...(fields ? [{ $project: Object.fromEntries(fields.split(" ").map((field) => [field, 1])) }] : []),
		{
			$lookup: {
				from: Contact.collection.collectionName,
				localField: "_id",
				foreignField: "newsletterId",
				pipeline: [{ $match: { status: "active" } }, { $count: "count" }],
				as: "active",
			},
		},
		{ $set: { activeCount: { $ifNull: [{ $first: "$acti