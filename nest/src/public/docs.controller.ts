import { readFileSync } from 'fs';
import { join } from 'path';
import { Controller, Get, Header } from '@nestjs/common';

/**
 * 公開API ドキュメント（認証なしで閲覧可）。
 * - GET /api/docs            : OpenAPI を Redoc で表示する HTML
 * - GET /api/docs/openapi.yaml : OpenAPI 仕様（YAML）
 *
 * YAML は nest-cli の assets 設定で dist へコピーされ、__dirname 相対で読む。
 */
@Controller('docs')
export class DocsController {
  // 起動時に一度だけ読み込む（dist/public/openapi/ に配置される）。
  private readonly spec = readFileSync(join(__dirname, 'openapi', 'public-api.v1.yaml'), 'utf8');

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  page(): string {
    return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Backひろ 公開API ドキュメント</title>
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <redoc spec-url="/api/docs/openapi.yaml"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;
  }

  @Get('openapi.yaml')
  @Header('Content-Type', 'application/yaml; charset=utf-8')
  yaml(): string {
    return this.spec;
  }
}
