import type { Pool } from 'pg';

export type Db = Pool;

export interface Actor {
  id: string;
  name: string;
  role: string;
}

export interface PermLike {
  can(db: Db, role: string, m: string, f: string): Promise<boolean>;
}

export interface Api {
  db: Db;
  auth: { current(): Actor | null };
  perm: PermLike;
}

export interface ScRow {
  id: string;
  xe_id: string;
  trang_thai: string;
  ngay_tao: string;
  nguoi_tao?: string;
  tong_cong?: number;
  tong_vt?: number;
  tong?: number;
  is_test?: number;
  deleted_at?: string;
}
