import type {
  CreateMissionResponse,
  EventDto,
  GetMissionResponse,
  ListMissionsResponse,
  ListTasksResponse,
  MissionDto,
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
