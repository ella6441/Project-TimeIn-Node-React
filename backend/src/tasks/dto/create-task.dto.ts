import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Build login page' })
  @IsString()
  taskName: string;

  @ApiPropertyOptional({ example: 'Design and implement the login screen' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'uuid-of-project' })
  @IsString()
  projectId: string;

  @ApiPropertyOptional({ example: 'uuid-of-user' })
  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @ApiPropertyOptional({
    enum: ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
    default: 'TODO',
  })
  @IsIn(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM',
  })
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional({ example: 'clickup-task-id' })
  @IsString()
  @IsOptional()
  clickUpTaskId?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsNumber()
  @IsOptional()
  estimatedHours?: number;
}
