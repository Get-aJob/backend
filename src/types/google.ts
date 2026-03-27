export interface IGoogleToken {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token: string;
}

export interface IGoogleUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}
