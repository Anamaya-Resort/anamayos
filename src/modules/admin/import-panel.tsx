'use client';

import { StreamingImport } from './streaming-import';
import type { TranslationKeys } from '@/i18n/en';

interface ImportPanelProps {
  dict: TranslationKeys;
}

export function ImportPanel({ dict }: ImportPanelProps) {
  return (
    <div className="space-y-8">
      {/* Retreat Guru */}
      <StreamingImport
        title={dict.settings.importRG}
        description={dict.settings.importRGDesc}
        endpoint="/api/admin/import/retreat-guru"
        buttonLabel={dict.settings.importFullLabel}
        updateButtonLabel={dict.settings.importUpdateLabel}
        runningLabel={dict.settings.importRunning}
        successLabel={dict.settings.importSuccess}
        failedLabel={dict.settings.importFailed}
        errorsLabel={dict.settings.importErrors}
        supportsIncremental
      />

      {/* WeTravel */}
      <StreamingImport
        title={dict.settings.importWT}
        description={dict.settings.importWTDesc}
        endpoint="/api/admin/import/wetravel"
        buttonLabel={dict.settings.importStart}
        runningLabel={dict.settings.importRunning}
        successLabel={dict.settings.importSuccess}
        failedLabel={dict.settings.importFailed}
        errorsLabel={dict.settings.importErrors}
      />
    </div>
  );
}
