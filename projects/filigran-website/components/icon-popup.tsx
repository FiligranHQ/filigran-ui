import React, { FC, ReactElement, useState } from 'react';

interface PopupProps {
    icon: ReactElement | null;
    iconName: string;
    onClose: () => void;
}

const Popup: FC<PopupProps> = ({ icon, iconName, onClose }) => {
    const [copySuccess, setCopySuccess] = useState(false);

    const handleCopy = () => {
        const statement = `import { ${iconName} } from '@filigran-ui';`;
        navigator.clipboard.writeText(statement)
            .then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            })
            .catch(err => console.error('Failed to copy:', err));
    };

    if (!icon) return null;

    const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50" onClick={handleBackgroundClick}>
            <div className="bg-white shadow-lg rounded-lg max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
                <div className="p-6">
                    <div className="relative mb-6">
                        <div className="bg-gray-900 rounded-md p-4 font-mono text-sm overflow-x-auto">
                            <span className="text-blue-400">import </span>
                            <span className="text-purple-400">{'{ '}</span>
                            <span className="text-white font-semibold">{iconName}</span>
                            <span className="text-purple-400">{' }'}</span>
                            <span className="text-blue-400"> from </span>
                            <span className="text-green-400">'@filigran-icon'</span>
                            <span className="text-blue-400">;</span>
                        </div>
                        <button 
                            onClick={handleCopy}
                            className={`absolute top-2 right-2 px-3 py-1 text-sm font-medium rounded-md transition-colors duration-200 ease-in-out ${
                                copySuccess 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                        >
                            {copySuccess ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <div className='flex items-center justify-center mb-6 max-w-30 max-h-30'>
                        {icon}
                    </div>
                    <div className="flex justify-end">
                        <button 
                            onClick={onClose} 
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Popup;