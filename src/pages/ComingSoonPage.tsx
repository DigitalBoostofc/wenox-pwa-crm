import { Rocket } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function ComingSoonPage({ titulo }: { titulo: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Rocket className="size-7" />
        </div>
        <h2 className="text-xl font-semibold">{titulo}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Este módulo entra numa próxima sprint do Wenox OS. A fundação visual já
          está pronta para recebê-lo.
        </p>
      </CardContent>
    </Card>
  );
}
