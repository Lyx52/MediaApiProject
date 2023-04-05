import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { join } from 'path';
import { YAML_CONFIG_LOCATION } from "../../app.constants";
export default () => {
  return yaml.load(
    readFileSync(join(__dirname, YAML_CONFIG_LOCATION), 'utf8'),
  ) as Record<string, any>;
};
