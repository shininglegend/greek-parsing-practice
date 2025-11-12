import { useEffect, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <dialog 
      ref={dialogRef}
      className="rounded-lg shadow-xl p-0 max-w-4xl w-full max-h-[90vh] backdrop:bg-black/50"
      onClick={(e) => {
        // Close when clicking the backdrop
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 text-2xl leading-none px-2"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-3 overflow-y-auto">
          {children}
        </div>
      </div>
    </dialog>
  );
}
