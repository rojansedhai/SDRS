import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
}

/**
 * ConfirmDialog component for critical actions.
 * @param {ConfirmDialogProps} props
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  onConfirm,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />,
          button: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
        };
      case 'info':
        return {
          icon: <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />,
          button: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
        };
      case 'warning':
      default:
        return {
          icon: <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
          button: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 transition-opacity" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white dark:bg-slate-800 p-6 shadow-xl focus:outline-none">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 rounded-full bg-slate-100 dark:bg-slate-700 p-2">
              {styles.icon}
            </div>
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-white">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {description}
              </Dialog.Description>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors">
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors ${styles.button}`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
