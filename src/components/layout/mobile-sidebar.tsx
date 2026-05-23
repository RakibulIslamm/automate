'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SidebarBody, type SidebarProps } from './sidebar';

/**
 * Mobile sidebar: hamburger that opens a `<Sheet>` containing the same body
 * as the desktop sidebar. Auto-closes on nav.
 */
export function MobileSidebar(props: Omit<SidebarProps, 'onNavigate' | 'className'>) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Site navigation</SheetDescription>
        </SheetHeader>
        <SidebarBody {...props} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
