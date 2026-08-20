'use client';

import { useLocale } from '@/components/field/locale';
import { t as translate } from '@/lib/i18n';

export function SyntheticDataNotice() {
    const { t, locale } = useLocale();

    return (
        <div
            className="mt-4 rounded-md border-2 px-4 py-3 text-sm font-bold"
            style={{
                borderColor: 'var(--field-rule)',
                backgroundColor: 'var(--field-notice)',
            }}
        >
            <p>{translate('data.syntheticNotice', 'en')}</p>
            {locale === 'hi' && <p className="mt-1">{t('data.syntheticNotice')}</p>}
        </div>
    );
}