import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ACTIVE_CAMPAIGN_STATUSES,
  ALL_CAMPAIGN_STATUSES,
  VoxGetAccountInfoResponse,
  VoxSearchCampaignsResponse,
} from './voximplant.types';

type VoxCredentials = {
  host: string;
  domain: string;
  accessToken: string;
};

export class VoximplantApiError extends InternalServerErrorException {
  constructor(
    public readonly statusCode: number,
    public readonly responseBody?: unknown,
  ) {
    super(
      `Voximplant API responded with status ${statusCode}${
        responseBody ? `: ${JSON.stringify(responseBody)}` : ''
      }`,
    );
  }
}

@Injectable()
export class VoximplantApiService {
  async getAccountInfo(credentials: VoxCredentials): Promise<VoxGetAccountInfoResponse> {
    return this.request<VoxGetAccountInfoResponse>({
      credentials,
      path: '/api/v3/account/getAccountInfo',
      body: {
        access_token: credentials.accessToken,
      },
    });
  }

  async searchCampaigns(credentials: VoxCredentials): Promise<VoxSearchCampaignsResponse> {
    return this.searchCampaignsWithStatuses(credentials, ACTIVE_CAMPAIGN_STATUSES);
  }

  async searchCampaignsWithStatuses(
    credentials: VoxCredentials,
    statuses: readonly string[],
  ): Promise<VoxSearchCampaignsResponse> {
    return this.request<VoxSearchCampaignsResponse>({
      credentials,
      path: '/api/v3/campaigns/search',
      body: {
        access_token: credentials.accessToken,
        statuses: JSON.stringify(statuses),
      },
    });
  }

  async pauseCampaign(credentials: VoxCredentials, campaignId: number): Promise<unknown> {
    return this.request({
      credentials,
      path: '/api/v3/campaigns/pause',
      body: {
        id: String(campaignId),
        access_token: credentials.accessToken,
      },
    });
  }

  async resumeCampaign(credentials: VoxCredentials, campaignId: number): Promise<unknown> {
    return this.request({
      credentials,
      path: '/api/v3/campaigns/resume',
      body: {
        id: String(campaignId),
        access_token: credentials.accessToken,
      },
    });
  }

  private async request<T>(params: {
    credentials: VoxCredentials;
    path: string;
    body: Record<string, string>;
  }): Promise<T> {
    const url = this.buildUrl(params.credentials.host, params.credentials.domain, params.path);

    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params.body)) {
      body.append(key, value);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: controller.signal,
      });

      const rawText = await response.text();
      const parsed = this.tryParseJson(rawText);

      if (!response.ok) {
        throw new VoximplantApiError(response.status, parsed ?? rawText);
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new InternalServerErrorException('Voximplant API returned non-JSON response');
      }

      return parsed as T;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException('Voximplant API request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(host: string, domain: string, path: string): string {
    const normalizedHost = host
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
      .trim();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const query = new URLSearchParams({ domain }).toString();

    return `https://${normalizedHost}${normalizedPath}?${query}`;
  }

  private tryParseJson(input: string): unknown {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }
}
