import { config } from "../config.js";
import { apiGet, apiPost, apiPatch } from "../http.js";

const headers = () => ({
  Authorization: `Bearer ${config.karbon.bearerToken}`,
  AccessKey: config.karbon.accessKey,
  Accept: "application/json",
});

const url = (path: string) => `${config.karbon.baseUrl}${path}`;

// ── Contacts ────────────────────────────────────────────────

export interface KarbonContact {
  ContactKey: string;
  FullName: string;
  EmailAddress: string;
  OrganizationKey?: string;
  PhoneNumber?: string;
  [key: string]: unknown;
}

export async function listContacts(filter?: string) {
  const query = filter ? `?$filter=${encodeURIComponent(filter)}` : "";
  return apiGet<KarbonContact[]>(url(`/Contacts${query}`), headers());
}

export async function getContact(contactKey: string) {
  return apiGet<KarbonContact>(url(`/Contacts/${contactKey}`), headers());
}

export async function searchContacts(search: string) {
  return apiGet<KarbonContact[]>(
    url(`/Contacts?$filter=contains(FullName,'${search}')`),
    headers(),
  );
}

// ── Organizations ───────────────────────────────────────────

export interface KarbonOrganization {
  OrganizationKey: string;
  OrganizationName: string;
  [key: string]: unknown;
}

export async function listOrganizations(filter?: string) {
  const query = filter ? `?$filter=${encodeURIComponent(filter)}` : "";
  return apiGet<KarbonOrganization[]>(url(`/Organizations${query}`), headers());
}

export async function getOrganization(orgKey: string) {
  return apiGet<KarbonOrganization>(url(`/Organizations/${orgKey}`), headers());
}

// ── Work Items ──────────────────────────────────────────────

export interface KarbonWorkItem {
  WorkItemKey: string;
  Title: string;
  WorkItemStatusKey?: string;
  ClientKey?: string;
  AssigneeKey?: string;
  StartDate?: string;
  DueDate?: string;
  Description?: string;
  WorkItemTypeKey?: string;
  [key: string]: unknown;
}

export async function listWorkItems(filter?: string) {
  const query = filter ? `?$filter=${encodeURIComponent(filter)}` : "";
  return apiGet<KarbonWorkItem[]>(url(`/WorkItems${query}`), headers());
}

export async function getWorkItem(workItemKey: string) {
  return apiGet<KarbonWorkItem>(url(`/WorkItems/${workItemKey}`), headers());
}

export async function createWorkItem(data: Partial<KarbonWorkItem>) {
  return apiPost<KarbonWorkItem>(url("/WorkItems"), headers(), data);
}

export async function updateWorkItem(
  workItemKey: string,
  data: Partial<KarbonWorkItem>,
) {
  return apiPatch<KarbonWorkItem>(
    url(`/WorkItems/${workItemKey}`),
    headers(),
    data,
  );
}

// ── Work Item Statuses ──────────────────────────────────────

export interface KarbonWorkItemStatus {
  WorkItemStatusKey: string;
  StatusName: string;
  [key: string]: unknown;
}

export async function listWorkItemStatuses() {
  return apiGet<KarbonWorkItemStatus[]>(url("/WorkItemStatuses"), headers());
}

// ── Tasks (To-Dos within Work Items) ────────────────────────

export interface KarbonTask {
  TaskKey: string;
  WorkItemKey: string;
  Title: string;
  IsCompleted: boolean;
  AssigneeKey?: string;
  DueDate?: string;
  [key: string]: unknown;
}

export async function listTasks(workItemKey: string) {
  return apiGet<KarbonTask[]>(
    url(`/WorkItems/${workItemKey}/Tasks`),
    headers(),
  );
}

export async function createTask(
  workItemKey: string,
  data: Partial<KarbonTask>,
) {
  return apiPost<KarbonTask>(
    url(`/WorkItems/${workItemKey}/Tasks`),
    headers(),
    data,
  );
}

export async function updateTask(
  workItemKey: string,
  taskKey: string,
  data: Partial<KarbonTask>,
) {
  return apiPatch<KarbonTask>(
    url(`/WorkItems/${workItemKey}/Tasks/${taskKey}`),
    headers(),
    data,
  );
}

// ── Notes (Timeline entries) ────────────────────────────────

export interface KarbonNote {
  NoteKey: string;
  Body: string;
  AuthorKey?: string;
  CreatedDate?: string;
  [key: string]: unknown;
}

export async function listNotes(workItemKey: string) {
  return apiGet<KarbonNote[]>(
    url(`/WorkItems/${workItemKey}/Notes`),
    headers(),
  );
}

export async function addNote(workItemKey: string, body: string) {
  return apiPost<KarbonNote>(url(`/WorkItems/${workItemKey}/Notes`), headers(), {
    Body: body,
  });
}

// ── Timesheets ──────────────────────────────────────────────

export interface KarbonTimeEntry {
  TimeEntryKey: string;
  WorkItemKey?: string;
  ContactKey?: string;
  Minutes: number;
  Description?: string;
  EntryDate?: string;
  [key: string]: unknown;
}

export async function listTimeEntries(filter?: string) {
  const query = filter ? `?$filter=${encodeURIComponent(filter)}` : "";
  return apiGet<KarbonTimeEntry[]>(url(`/TimeEntries${query}`), headers());
}

export async function createTimeEntry(data: Partial<KarbonTimeEntry>) {
  return apiPost<KarbonTimeEntry>(url("/TimeEntries"), headers(), data);
}

// ── Users / Team Members ────────────────────────────────────

export interface KarbonUser {
  UserKey: string;
  FullName: string;
  EmailAddress: string;
  [key: string]: unknown;
}

export async function listUsers() {
  return apiGet<KarbonUser[]>(url("/Users"), headers());
}
