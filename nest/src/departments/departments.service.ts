import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './department.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
  ) {}

  listByTenant(tenantId: string): Promise<Department[]> {
    return this.departments.find({
      where: { tenantId },
      order: { code: 'ASC' },
    });
  }

  /** 部署作成（現状は CLI 移行用途のみ。今後 UI を作るなら DTO 経由に） */
  create(tenantId: string, input: { code: string; name: string }): Promise<Department> {
    const dept = this.departments.create({
      tenantId,
      code: input.code,
      name: input.name,
    });
    return this.departments.save(dept);
  }
}
