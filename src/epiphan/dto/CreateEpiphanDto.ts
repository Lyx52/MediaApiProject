import { IsString } from 'class-validator';

export class CreateEpiphanDto {
  @IsString({always: true})
  readonly name: string;
  @IsString({always: true})
  readonly host: string;
  @IsString({always: true})
  readonly username: string;
  @IsString({always: true})
  readonly password: string;
}
