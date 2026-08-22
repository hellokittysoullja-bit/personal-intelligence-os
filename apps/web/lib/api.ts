import type {
  CaptureOwnerEvidenceRequest,
  CapturePublicEvidenceRequest,
  CaptureOwnerEvidenceResponse,
  ConfirmMissionContractRequest,
  CreateMissionResponse,
  EventDto,
  GetMissionResponse,
  GenerateResearchReportRequest,
  GenerateResearchReportResponse,
  ListEvidenceResponse,
  ListMissionsResponse,
  ListResearchReportsResponse,
  EvidenceDto,
  ListTasksResponse,
  MissionDto,
  CreateMemoryCandidateRequest,
  ListMemoriesResponse,
  MemoryDto,
  MemoryResponse,
  MemoryTransitionRequest,
  PlanResearchMissionRequest,
  ResearchReportDto,
  ListResearchReportVerificationsResponse,
  ResearchReportVerificationDto,
  VerifyResearchReportRequest,
  VerifyResearchReportResponse,
  UpdateMissionContractRequest,
  ApprovalDto,
  ApprovalResponse,
  DecideApprovalRequest,
  ListApprovalsResponse,
} from "@pios/contracts";

export function getApiUrl(): string {
  return "/api/pios";
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status}: ${body}`);
  }
  return (await response.json()) as T;
}

export async function listApprovals(): Promise<ApprovalDto[]> {
  const response = await fetch(`${getApiUrl()}/approvals`, { cache: "no-store" });
  const data = await parseJsonOrThrow<ListApprovalsResponse>(response);
  return data.approvals;
}

export async function decideApproval(approvalId: string, request: DecideApprovalRequest): Promise<ApprovalDto> {
  const response = await fetch(`${getApiUrl()}/approvals/${approvalId}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await parseJsonOrThrow<ApprovalResponse>(response);
  return data.approval;
}

export async function listMemories(includeForgotten = false): Promise<MemoryDto[]> {
  const suffix = includeForgotten ? "?includeForgotten=true" : "";
  const response = await fetch(`${getApiUrl()}/memories${suffix}`, { cache: "no-store" });
  const data = await parseJsonOrThrow<ListMemoriesResponse>(response);
  return data.memories;
}

export async function createMemoryCandidate(input: CreateMemoryCandidateRequest): Promise<MemoryDto> {
  const response = await fetch(`${getApiUrl()}/memories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJsonOrThrow<MemoryResponse>(response);
  return data.memory;
}

async function transitionMemory(
  memoryId: string,
  action: "approve" | "activate" | "forget",
  request: MemoryTransitionRequest,
): Promise<MemoryDto> {
  const response = await fetch(`${getApiUrl()}/memories/${memoryId}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await parseJsonOrThrow<MemoryResponse>(response);
  return data.memory;
}

export const approveMemory = (memoryId: string, request: MemoryTransitionRequest) => transitionMemory(memoryId, "approve", request);
export const activateMemory = (memoryId: string, request: MemoryTransitionRequest) => transitionMemory(memoryId, "activate", request);
export const forgetMemory = (memoryId: string, request: MemoryTransitionRequest) => transitionMemory(memoryId, "forget", request);

export async function listMissions(): Promise<MissionDto[]> {
  const response = await fetch(`${getApiUrl()}/missions`, { cache: "no-store" });
  const data = await parseJsonOrThrow<ListMissionsResponse>(response);
  return data.missions;
}

export async function createMission(rawRequest: string): Promise<MissionDto> {
  const response = await fetch(`${getApiUrl()}/missions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawRequest }),
  });
  const data = await parseJsonOrThrow<CreateMissionResponse>(response);
  return data.mission;
}

export async function updateMissionContract(
  missionId: string,
  contract: UpdateMissionContractRequest,
): Promise<MissionDto> {
  const response = await fetch(`${getApiUrl()}/missions/${missionId}/contract`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contract),
  });
  const data = await parseJsonOrThrow<CreateMissionResponse>(response);
  return data.mission;
}

export async function confirmMissionContract(
  missionId: string,
  request: ConfirmMissionContractRequest,
): Promise<MissionDto> {
  const response = await fetch(`${getApiUrl()}/missions/${missionId}/contract/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await parseJsonOrThrow<CreateMissionResponse>(response);
  return data.mission;
}

export async function planResearchMission(
  missionId: string,
  request: PlanResearchMissionRequest,
): Promise<MissionDto> {
  const response = await fetch(`${getApiUrl()}/missions/${missionId}/research/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await parseJsonOrThrow<CreateMissionResponse>(response);
  return data.mission;
}

export async function captureOwnerEvidence(
  missionId: string,
  evidence: CaptureOwnerEvidenceRequest,
): Promise<EvidenceDto> {
  const response = await fetch(`${getApiUrl()}/missions/${missionId}/evidence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(evidence),
  });
  const data = await parseJsonOrThrow<CaptureOwnerEvidenceResponse>(response);
  return data.evidence;
}

export async function capturePublicEvidence(
  missionId: string,
  request: CapturePublicEvidenceRequest,
): Promise<EvidenceDto> {
  const response = await fetch(`${getApiUrl()}/missions/${missionId}/evidence/fetch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await parseJsonOrThrow<CaptureOwnerEvidenceResponse>(response);
  return data.evidence;
}

export async function listEvidence(missionId: string): Promise<EvidenceDto[]> {
  const response = await fetch(`${getApiUrl()}/missions/${missionId}/evidence`, { cache: "no-store" });
  const data = await parseJsonOrThrow<ListEvidenceResponse>(response);
  return data.evidence;
}

export async function generateResearchReport(
  missionId: string,
  request: GenerateResearchReportRequest = {},
): Promise<ResearchReportDto> {
  const response = await fetch(`${getApiUrl()}/missions/${missionId}/reports/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await parseJsonOrThrow<GenerateResearchReportResponse>(response);
  return data.report;
}

export async function listResearchReports(missionId: string): Promise<ResearchReportDto[]> {
  const response = await fetch(`${getApiUrl()}/missions/${missionId}/reports`, { cache: "no-store" });
  const data = await parseJsonOrThrow<ListResearchReportsResponse>(response);
  return data.reports;
}

export async function verifyResearchReport(
  missionId: string,
  reportId: string,
  request: VerifyResearchReportRequest = {},
): Promise<ResearchReportVerificationDto> {
  const response = await fetch(`${getApiUrl()}/missions/${missionId}/reports/${reportId}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const data = await parseJsonOrThrow<VerifyResearchReportResponse>(response);
  return data.verification;
}

export async function listResearchReportVerifications(
  missionId: string,
  reportId: string,
): Promise<ResearchReportVerificationDto[]> {
  const response = await fetch(`${getApiUrl()}/missions/${missionId}/reports/${reportId}/verifications`, { cache: "no-store" });
  const data = await parseJsonOrThrow<ListResearchReportVerificationsResponse>(response);
  return data.verifications;
}

export async function getMission(id: string): Promise<MissionDto> {
  const response = await fetch(`${getApiUrl()}/missions/${id}`, { cache: "no-store" });
  const data = await parseJsonOrThrow<GetMissionResponse>(response);
  return data.mission;
}

export async function listTasks(missionId: string): Promise<ListTasksResponse["tasks"]> {
  const response = await fetch(`${getApiUrl()}/missions/${missionId}/tasks`, {
    cache: "no-store",
  });
  const data = await parseJsonOrThrow<ListTasksResponse>(response);
  return data.tasks;
}

export function subscribeToMissionEvents(
  missionId: string,
  onEvent: (event: EventDto) => void,
): () => void {
  const source = new EventSource(`${getApiUrl()}/missions/${missionId}/events/stream`);
  source.onmessage = (message) => {
    try {
      onEvent(JSON.parse(message.data) as EventDto);
    } catch {
      // игнорируем некорректные сообщения потока
    }
  };
  return () => source.close();
}
