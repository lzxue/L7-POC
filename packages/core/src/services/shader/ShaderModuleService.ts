/// <reference path="glsl.d.ts"/>

import { inject, injectable } from 'inversify';
import { ILogger, LoggingContext } from 'inversify-logging';
import { uniq } from 'lodash';
import IShaderModuleService, { IModuleParams } from './IShaderModuleService';
import { extractUniforms } from '../../utils/shader-module';
import { TYPES } from '../../types';

// import decode from '../../shaders/decode.glsl';
// import sdf2d from '../../shaders/sdf_2d.glsl';
// import circleVert from '../../shaders/circle_vert.glsl';
// import circleFrag from '../../shaders/circle_frag.glsl';

const precisionRegExp = /precision\s+(high|low|medium)p\s+float/;
const globalDefaultprecision = '#ifdef GL_FRAGMENT_PRECISION_HIGH\n precision highp float;\n #else\n precision mediump float;\n#endif\n';
const includeRegExp = /#pragma include (["^+"]?["\ "[a-zA-Z_0-9](.*)"]*?)/g;

@injectable()
@LoggingContext('ShaderModuleService')
export default class ShaderModuleService implements IShaderModuleService {
  @inject(TYPES.ILogService) logger: ILogger;

  private moduleCache: { [key: string]: IModuleParams; } = {};
  private rawContentCache: { [key: string]: IModuleParams; } = {};

  public registerBuiltinModules() {
    // this.registerModule('decode', { vs: decode, fs: '' });
    // this.registerModule('sdf_2d', { vs: '', fs: sdf2d });
    // this.registerModule('circle', { vs: circleVert, fs: circleFrag });
    this.logger.info('builtin modules compiled');
  }

  public registerModule(moduleName: string, moduleParams: IModuleParams) {
    const { vs, fs, uniforms: declaredUniforms } = moduleParams;
    const { content: extractedVS, uniforms: vsUniforms } = extractUniforms(vs);
    const { content: extractedFS, uniforms: fsUniforms } = extractUniforms(fs);
  
    this.rawContentCache[moduleName] = {
      vs: extractedVS,
      fs: extractedFS,
      uniforms: {
        ...vsUniforms,
        ...fsUniforms,
        ...declaredUniforms
      }
    };
  }

  public getModule(moduleName: string): IModuleParams {
    if (this.moduleCache[moduleName]) {
      return this.moduleCache[moduleName];
    }
  
    let rawVS = this.rawContentCache[moduleName].vs;
    const rawFS = this.rawContentCache[moduleName].fs;
  
    const { content: vs, includeList: vsIncludeList } = this.processModule(rawVS, [], 'vs');
    let { content: fs, includeList: fsIncludeList } = this.processModule(rawFS, [], 'fs');
    // TODO: extract uniforms and their default values from GLSL
    const uniforms: {
      [key: string]: any;
    } = uniq(vsIncludeList.concat(fsIncludeList).concat(moduleName)).reduce((prev, cur) => {
      return {
        ...prev,
        ...this.rawContentCache[cur].uniforms
      };
    }, {});
  
    /**
     * set default precision for fragment shader
     * https://stackoverflow.com/questions/28540290/why-it-is-necessary-to-set-precision-for-the-fragment-shader
     */
    if (!precisionRegExp.test(fs)) {
      fs = globalDefaultprecision + fs;
    }
  
    this.moduleCache[moduleName] = {
      vs: vs.trim(),
      fs: fs.trim(),
      uniforms
    };
    return this.moduleCache[moduleName];
  }

  private processModule(rawContent: string, includeList: Array<string>, type: 'vs' | 'fs'): {
    content: string;
    includeList: string[];
  } {
    const compiled = rawContent.replace(includeRegExp, (_, strMatch) => {
      const includeOpt = strMatch.split(' ');
      const includeName = includeOpt[0].replace(/"/g, '');
  
      if (includeList.indexOf(includeName) > -1) {
        return '';
      }
  
      const txt = this.rawContentCache[includeName][type];
      includeList.push(includeName);
  
      const { content } = this.processModule(txt, includeList, type);
      return content;
    });
  
    return {
      content: compiled,
      includeList
    };
  }
}