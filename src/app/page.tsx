import { FieldHeader } from '@/components/field/header';
import { LocaleProvider } from '@/components/field/locale';
import { HomeView } from '@/components/home/HomeView';

export default function Home() {
  return (
    <LocaleProvider>
      <FieldHeader />
      <main className="flex-1">
        <HomeView />
      </main>
    </LocaleProvider>
  );
}
