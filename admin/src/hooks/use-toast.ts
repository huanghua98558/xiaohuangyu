"use client"

import { toast as sonnerToast } from "sonner"

type ToastVariant = "default" | "destructive" | "success"

interface ToastProps {
  title?: string
  description?: string
  variant?: ToastVariant
}

export function useToast() {
  const toast = ({ title, description, variant = "default" }: ToastProps) => {
    if (variant === "destructive") {
      sonnerToast.error(title, { description })
    } else if (variant === "success") {
      sonnerToast.success(title, { description })
    } else {
      sonnerToast(title, { description })
    }
  }

  return { toast }
}

// 直接导出toast函数，方便使用
export const toast = (props: ToastProps) => {
  const { title, description, variant = "default" } = props
  if (variant === "destructive") {
    sonnerToast.error(title, { description })
  } else if (variant === "success") {
    sonnerToast.success(title, { description })
  } else {
    sonnerToast(title, { description })
  }
}
