import type { Incident, CustomMarking, VideoFrame, IncidentStats, ReconstructionAnnotation, ReconstructionData } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

export interface User {
  id: string;
  email: string;
  name: string;
  profile_image?: string | null;
  created_at: string;
  last_login: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface JobStatus {
  incident_id: string;
  status: string;
  progress_pct: number;
  current_stage: string;
  error_message?: string | null;
  stats?: IncidentStats;
  completed: boolean;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('aeromesh_auth_token');
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('aeromesh_auth_token', token);
    } else {
      localStorage.removeItem('aeromesh_auth_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return null as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  // ── Auth Endpoints ────────────────────────────────────────────────────────
  public async loginWithGoogle(idToken: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    });
    this.setToken(res.access_token);
    return res;
  }

  public async loginWithEmail(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  public async loginWithRescuerId(rescuer_id: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/rescuer/login', {
      method: 'POST',
      body: JSON.stringify({ rescuer_id, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  public async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    this.setToken(res.access_token);
    return res;
  }

  public async devLogin(email = 'analyst@aeromesh.ai', name = 'Keshav'): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
    this.setToken(res.access_token);
    return res;
  }

  public async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      this.setToken(null);
    }
  }

  // ── Incident Endpoints ────────────────────────────────────────────────────
  public async listIncidents(startDate?: string, endDate?: string): Promise<Incident[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Incident[]>(`/incidents${query}`);
  }

  public async getIncident(id: string): Promise<Incident> {
    return this.request<Incident>(`/incidents/${id}`);
  }

  public async createIncident(data: { name: string; location: string; description: string }): Promise<Incident> {
    return this.request<Incident>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async deleteIncident(id: string): Promise<void> {
    return this.request<void>(`/incidents/${id}`, { method: 'DELETE' });
  }

  public async uploadVideo(
    incidentId: string,
    file: File
  ): Promise<{ message: string; metadata: any; videoUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<{ message: string; metadata: any; videoUrl: string }>(
      `/incidents/${incidentId}/video`,
      {
        method: 'POST',
        body: formData,
      }
    );
  }

  public async startAnalysis(incidentId: string): Promise<{ message: string; incident_id: string; status: string }> {
    return this.request<{ message: string; incident_id: string; status: string }>(
      `/incidents/${incidentId}/analyze`,
      { method: 'POST' }
    );
  }

  public async getJobStatus(incidentId: string): Promise<JobStatus> {
    return this.request<JobStatus>(`/incidents/${incidentId}/status`);
  }

  public async getFrames(incidentId: string): Promise<VideoFrame[]> {
    return this.request<VideoFrame[]>(`/incidents/${incidentId}/frames`);
  }

  public async getMarkings(incidentId: string): Promise<CustomMarking[]> {
    return this.request<CustomMarking[]>(`/incidents/${incidentId}/markings`);
  }

  public async addMarking(
    incidentId: string,
    marking: { name: string; type: string; color: string; description?: string; position: [number, number, number] }
  ): Promise<CustomMarking> {
    return this.request<CustomMarking>(`/incidents/${incidentId}/markings`, {
      method: 'POST',
      body: JSON.stringify(marking),
    });
  }

  public async deleteMarking(markingId: string): Promise<void> {
    return this.request<void>(`/incidents/markings/${markingId}`, { method: 'DELETE' });
  }

  public async updateMarkingPosition(
    markingId: string,
    position: [number, number, number]
  ): Promise<CustomMarking> {
    return this.request<CustomMarking>(`/incidents/markings/${markingId}/position`, {
      method: 'PUT',
      body: JSON.stringify({ position }),
    });
  }

  public async updateMarkingVisibility(
    markingId: string,
    visible: boolean
  ): Promise<CustomMarking> {
    return this.request<CustomMarking>(`/incidents/markings/${markingId}/visibility`, {
      method: 'PUT',
      body: JSON.stringify({ visible }),
    });
  }

  public async getReconstruction(incidentId: string): Promise<ReconstructionData> {
    return this.request<ReconstructionData>(`/incidents/${incidentId}/reconstruction`);
  }

  public async getAnnotations(incidentId: string): Promise<ReconstructionAnnotation[]> {
    return this.request<ReconstructionAnnotation[]>(`/incidents/${incidentId}/annotations`);
  }

  public getModelUrl(glbPath: string | null | undefined): string | null {
    if (!glbPath) return null;
    if (glbPath.startsWith('http://') || glbPath.startsWith('https://')) return glbPath;
    const cleanPath = glbPath.startsWith('/') ? glbPath : `/${glbPath}`;
    return `http://localhost:8000${cleanPath}`;
  }

  public getDownloadReportUrl(incidentId: string): string {
    return `${API_BASE_URL}/incidents/${incidentId}/report/download`;
  }
}

export const api = new ApiService();
