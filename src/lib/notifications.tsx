import React from 'react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Check, UserCheck, ClipboardCheck, Activity, HeartHandshake, FileText, X } from 'lucide-react';

interface SuccessNotificationProps {
  id: string | number;
  title: string;
  description?: string;
  type?: 'citizen' | 'atendimento' | 'medico' | 'auxilio' | 'demanda';
}

const SuccessNotification: React.FC<SuccessNotificationProps> = ({ id, title, description, type }) => {
  // Select icon and color scheme based on type
  let IconComponent = Check;
  let colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  let glowColor = 'shadow-emerald-500/10';

  if (type === 'citizen') {
    IconComponent = UserCheck;
    colorClass = 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    glowColor = 'shadow-blue-500/10';
  } else if (type === 'medico') {
    IconComponent = Activity;
    colorClass = 'text-teal-400 bg-teal-500/10 border-teal-500/20';
    glowColor = 'shadow-teal-500/10';
  } else if (type === 'auxilio') {
    IconComponent = HeartHandshake;
    colorClass = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    glowColor = 'shadow-purple-500/10';
  } else if (type === 'demanda') {
    IconComponent = FileText;
    colorClass = 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    glowColor = 'shadow-orange-500/10';
  } else if (type === 'atendimento') {
    IconComponent = ClipboardCheck;
    colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    glowColor = 'shadow-emerald-500/10';
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 350 }}
      className={`relative flex items-start gap-4 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-xl ${glowColor} max-w-sm w-full`}
    >
      {/* Ripple/Pulse effect behind the icon */}
      <div className="relative flex-shrink-0">
        <motion.div
          initial={{ scale: 0.8, opacity: 0.5 }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className={`absolute inset-0 rounded-full border border-current opacity-40 ${colorClass}`}
        />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
          className={`w-10 h-10 rounded-full border flex items-center justify-center ${colorClass}`}
        >
          <IconComponent size={20} className="stroke-[2.5]" />
        </motion.div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-4">
        <motion.h4
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="text-sm font-bold text-slate-100 font-sans tracking-tight"
        >
          {title}
        </motion.h4>
        {description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-xs text-slate-400 mt-0.5 leading-relaxed font-sans"
          >
            {description}
          </motion.p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => toast.dismiss(id)}
        className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded-lg transition-colors absolute top-3 right-3"
        aria-label="Fechar"
      >
        <X size={14} />
      </button>

      {/* Subtle success colored lightbar on the left side of the card */}
      <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${
        type === 'citizen' ? 'bg-blue-500' :
        type === 'medico' ? 'bg-teal-500' :
        type === 'auxilio' ? 'bg-purple-500' :
        type === 'demanda' ? 'bg-orange-500' :
        'bg-emerald-500'
      }`} />
    </motion.div>
  );
};

export const showSuccessNotification = (
  title: string,
  description?: string,
  type?: 'citizen' | 'atendimento' | 'medico' | 'auxilio' | 'demanda'
) => {
  toast.custom((id) => (
    <SuccessNotification id={id} title={title} description={description} type={type} />
  ), {
    duration: 5000,
  });
};
