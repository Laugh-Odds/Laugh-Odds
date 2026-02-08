import React, { useRef, useState, useEffect } from 'react';
import { Plus, Minus, Trash2 } from 'lucide-react';
import { TextBox } from './types';

interface TextControlProps {
  box: TextBox;
  onTextChange: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onFontSizeChange: (id: string, increase: boolean) => void;
  onColorChange: (id: string, color: string) => void;
}

export const TextControl: React.FC<TextControlProps> = ({
  box,
  onTextChange,
  onRemove,
  onFontSizeChange,
  onColorChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(box.text);

  // Update local state when box.text changes
  useEffect(() => {
    setInputValue(box.text);
  }, [box.text]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    onTextChange(box.id, inputValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // FIXED: Proper type casting for blur method
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full bg-gray-800 p-3 rounded-lg">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyPress={handleKeyPress}
          className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-lg focus:outline-none focus:border-blue-500"
          placeholder="Enter text"
          autoComplete="off"
          spellCheck="false"
        />
        <button
          onClick={() => onRemove(box.id)}
          className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
          type="button"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => onFontSizeChange(box.id, false)}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          type="button"
        >
          <Minus className="w-4 h-4" />
        </button>
        
        <span className="text-sm text-gray-300 min-w-[100px] text-center">
          Font Size: {box.fontSize}px
        </span>
        
        <button
          onClick={() => onFontSizeChange(box.id, true)}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          type="button"
        >
          <Plus className="w-4 h-4" />
        </button>
        
        <input
          type="color"
          value={box.color}
          onChange={(e) => onColorChange(box.id, e.target.value)}
          className="ml-auto w-8 h-8 rounded cursor-pointer bg-transparent"
        />
      </div>
    </div>
  );
};