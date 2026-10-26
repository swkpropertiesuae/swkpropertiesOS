package ae.swk.one

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.json.JSONObject

private data class Input(val key: String, val label: String, val type: String = "text", val choices: List<String> = emptyList(), val optional: Boolean = false)
private data class Workflow(val label: String, val path: String, val inputs: List<Input> = emptyList(), val permission: String = "edit")
private fun workflows(key: String, id: Int): List<Workflow> {
    val reason = Input("reason", "Reason (at least 10 characters)")
    val notes = Input("notes", "Review notes")
    return when (key) {
        "daily_reports" -> listOf(Workflow("Submit & freeze", "/api/daily-reports/$id/submit"), Workflow("Manager review", "/api/daily-reports/$id/review", listOf(Input("decision", "Decision", choices = listOf("approve", "return")), Input("feedback", "Feedback")), "approve"))
        "inventory_submissions" -> listOf(Workflow("Verify submission", "/api/inventory-submissions/$id/verify", listOf(Input("stage", "Verification stage", choices = listOf("inventory", "compliance")))), Workflow("Resolve duplicate conflict", "/api/inventory-submissions/$id/resolve-conflict", listOf(Input("resolution", "Resolution", choices = listOf("merge", "clear", "reject")), notes)), Workflow("Approve & publish", "/api/inventory-submissions/$id/publish", permission = "approve"))
        "developer_requests" -> listOf(Workflow("Record NOC submission", "/api/developer-requests/$id/submit", listOf(Input("portalRef", "Developer portal reference"), Input("senderEmail", "Sender company email"))), Workflow("Record issued NOC", "/api/developer-requests/$id/upload-noc", listOf(Input("nocNumber", "NOC number"), Input("issueDate", "Issue date (YYYY-MM-DD)"), Input("expiryDate", "Expiry date (YYYY-MM-DD)"), Input("docRef", "Attached document reference"))), Workflow("Verify NOC", "/api/developer-requests/$id/verify", listOf(Input("decision", "Decision", choices = listOf("verify", "flag_fraud")), notes), "approve"))
        "transactions" -> listOf(Workflow("Advance transaction", "/api/enterprise-transactions/$id/advance", listOf(Input("targetStage", "Target stage (exact workflow stage)"))), Workflow("Raise transaction exception", "/api/enterprise-transactions/$id/raise-exception", listOf(Input("exceptionType", "Exception type"), notes)), Workflow("Resolve exception", "/api/enterprise-transactions/$id/resolve-exception", listOf(Input("resolutionNotes", "Resolution notes"), Input("resumeStage", "Resume stage")), "approve"))
        "commission_entitlements" -> listOf(Workflow("Request commission payout", "/api/commission-entitlements/$id/initiate"), Workflow("Approve commission payout", "/api/commission-entitlements/$id/approve", permission = "approve"), Workflow("Record executed payout", "/api/commission-entitlements/$id/execute", listOf(Input("bankRef", "Actual bank payment reference")), "approve"), Workflow("Request IBAN update", "/api/commission-entitlements/$id/update-iban", listOf(Input("newIban", "New payee IBAN"))))
        "leave_requests" -> listOf(Workflow("Approve leave", "/api/hr/leave/$id/approve", permission = "approve"), Workflow("Reject leave", "/api/hr/leave/$id/reject", permission = "approve"))
        "knowledge_articles" -> listOf(Workflow("Acknowledge reading", "/api/knowledge/$id/acknowledge", permission = "view"), Workflow("Publish knowledge", "/api/knowledge/$id/publish", permission = "approve"), Workflow("Revise knowledge", "/api/knowledge/$id/revise", listOf(reason)))
        "qualifications" -> listOf(Workflow("Verify qualification", "/api/qualifications/$id/verify", permission = "approve"), Workflow("Revoke qualification", "/api/qualifications/$id/revoke", listOf(reason), "approve"))
        "agent_authorisations" -> listOf(Workflow("Activate authorisation", "/api/agent-authorisations/$id/activate", listOf(Input("stage", "Approval stage", choices = listOf("hr", "compliance"))), "approve"))
        "communications" -> listOf(Workflow("Escalate provider outage", "/api/communications/$id/outage", listOf(Input("fallbackNote", "Fallback coordination note"))), Workflow("Supervise company conversation", "/api/communications/$id/supervise", listOf(Input("actionType", "Review type", choices = listOf("Supervisor Quality Review", "Complaint Investigation", "Leave / Exit Ownership Handoff", "SLA Escalation Reassignment")), reason, Input("newOwnerId", "New owner user ID", "number", optional = true), Input("extractTaskTitle", "Follow-up task title", optional = true)), "approve"))
        "viewings" -> listOf(Workflow("Dispute viewing attendance", "/api/viewings/$id/dispute-attendance", listOf(Input("clientStatement", "Client statement and evidence"))))
        "leads" -> listOf(Workflow("Convert lead", "/api/leads/$id/convert", permission = "create"), Workflow("Request protected reassignment", "/api/leads/$id/reassign-protected", listOf(Input("toUserId", "New owner user ID", "number"), reason), "approve"))
        "work_items" -> listOf(Workflow("Update assigned work", "/api/work/items/$id/transition", listOf(Input("status", "Status", choices = listOf("In progress", "Waiting", "Completed", "Cancelled")), Input("note", "Resolution / handover note (at least 10 characters)"))))
        "universal_approvals" -> listOf(Workflow("Decide approval", "/api/universal-approvals/$id/decide", listOf(Input("decision", "Decision", choices = listOf("approve", "reject", "return")), Input("comments", "Decision comments")), "approve"))
        "qa_reviews" -> listOf(Workflow("Challenge review", "/api/qa-reviews/$id/challenge", listOf(Input("challengeReason", "Challenge and supporting evidence"))), Workflow("Resolve challenge", "/api/qa-reviews/$id/resolve-challenge", listOf(Input("decision", "Decision", choices = listOf("uphold", "adjust")), Input("adjustedScore", "Adjusted score", "number", optional = true), notes), "approve"))
        "compliance_cases" -> listOf(Workflow("Record case decision", "/api/compliance-cases/$id/decide", listOf(Input("findings", "Findings"), Input("remedyDecision", "Remedy decision")), "approve"), Workflow("Appeal decision", "/api/compliance-cases/$id/appeal", listOf(Input("appealNotes", "Appeal grounds"))))
        else -> emptyList()
    }
}
@Composable fun WorkflowActions(model: WorkspaceModel, entity: JSONObject, record: JSONObject) {
    val actions = workflows(entity.text("key"), record.optInt("id")).filter { model.permitted(entity, it.permission) }
    var selected by remember { mutableStateOf<Workflow?>(null) }
    val values = remember { mutableStateMapOf<String, String>() }
    var error by remember { mutableStateOf<String?>(null) }
    if (actions.isNotEmpty()) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Workflow actions", style = MaterialTheme.typography.titleMedium)
        actions.forEach { action -> OutlinedButton(onClick = { selected = action; values.clear(); error = null }) { Text(action.label) } }
    }
    selected?.let { action -> AlertDialog(onDismissRequest = { selected = null }, title = { Text(action.label) }, text = {
        Column(Modifier.heightIn(max = 450.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("This changes the shared SWK OS record. The server checks workflow eligibility, permissions and approvals.", style = MaterialTheme.typography.bodySmall)
            action.inputs.forEach { input ->
                if (input.choices.isNotEmpty()) {
                    Text(input.label, style = MaterialTheme.typography.labelMedium)
                    input.choices.forEach { choice -> Row { RadioButton(selected = values[input.key] == choice, onClick = { values[input.key] = choice }); TextButton(onClick = { values[input.key] = choice }) { Text(choice) } } }
                } else OutlinedTextField(values[input.key].orEmpty(), { values[input.key] = it }, label = { Text(input.label + if (input.optional) " (optional)" else " *") }, modifier = Modifier.fillMaxWidth())
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }, confirmButton = { TextButton(enabled = !model.state.value.loading, onClick = {
        try {
            val body = JSONObject()
            action.inputs.forEach { input -> val value = values[input.key].orEmpty().trim(); require(value.isNotBlank() || input.optional) { "Complete ${input.label}" }; if (value.isNotBlank()) body.put(input.key, if (input.type == "number") value.toDouble() else value) }
            model.recordAction(action.path, body); selected = null
        } catch (e: Exception) { error = e.message ?: "Check your entries" }
    }) { Text("Confirm action") } }, dismissButton = { TextButton(onClick = { selected = null }) { Text("Cancel") } }) }
}
