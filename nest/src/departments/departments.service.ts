import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/task.entity';
import { Department } from './department.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
  ) {}

  listByTenant(tenantId: string): Promise<Department[]> {
    return this.departments.find({
      where: { tenantId },
      order: { code: 'ASC' },
    });
  }

  /** 部署を作成。コードはテナント内で一意。 */
  async create(tenantId: string, dto: CreateDepartmentDto): Promise<Department> {
    const code = dto.code.trim();
    const existing = await this.departments.findOne({ where: { tenantId, code } });
    if (existing) throw new ConflictException('同じコードの部署が既に存在します');
    const dept = this.departments.create({ tenantId, code, name: dto.name.trim() });
    return this.departments.save(dept);
  }

  /** 部署名を更新（コードは識別子のため変更不可）。 */
  async update(tenantId: string, code: string, dto: UpdateDepartmentDto): Promise<Department> {
    const dept = await this.findInTenant(tenantId, code);
    dept.name = dto.name.trim();
    return this.departments.save(dept);
  }

  /**
   * 部署を削除。参照しているタスクの requesting_dept_code は null 化する
   * （メンバー削除時の assignee SET NULL と同等の振る舞い）。
   */
  async remove(tenantId: string, code: string): Promise<void> {
    const dept = await this.findInTenant(tenantId, code);
    await this.tasks
      .createQueryBuilder()
      .update(Task)
      .set({ requestingDeptCode: null })
      .where('requesting_dept_code = :code', { code })
      .andWhere('project_id IN (SELECT id FROM projects WHERE tenant_id = :tenantId)', { tenantId })
      .execute();
    await this.departments.remove(dept);
  }

  private async findInTenant(tenantId: string, code: string): Promise<Department> {
    const dept = await this.departments.findOne({ where: { tenantId, code } });
    if (!dept) throw new NotFoundException('部署が見つかりません');
    return dept;
  }
}
