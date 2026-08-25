export type VoxGetAccountInfoResponse = {
  success: boolean;
  result?: {
    domain?: {
      id?: number;
      name?: string;
      media_servers_regions?: string[] | null;
      partner?: {
        media_servers_regions?: string[] | null;
      } | null;
    };
  };
};

export type VoxCampaignItem = {
  id: number;
  title: string;
  status: 'draft' | 'scheduled' | 'paused' | 'ongoing' | 'completed' | string;
};

export type VoxSearchCampaignsResponse = {
  success: boolean;
  result?: VoxCampaignItem[];
};

export const ACTIVE_CAMPAIGN_STATUSES = [
  'scheduled',
  'draft',
  'ongoing',
  'paused',
] as const;

export const ALL_CAMPAIGN_STATUSES = [
  'draft',
  'scheduled',
  'paused',
  'ongoing',
  'completed',
] as const;
