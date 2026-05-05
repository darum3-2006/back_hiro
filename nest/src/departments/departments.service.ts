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
}
