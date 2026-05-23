import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  features: string[];
}

export function ComingSoonCard({ icon, title, description, features }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2">
              {title}
              <Badge variant="outline" className="font-normal">
                Coming soon
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
          {features.map((feature) => (
            <li key={feature}>· {feature}</li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="justify-end border-t pt-6">
        <Button variant="ghost" size="sm" disabled>
          Notify me
        </Button>
      </CardFooter>
    </Card>
  );
}
