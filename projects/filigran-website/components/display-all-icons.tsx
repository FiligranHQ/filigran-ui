'use client'
import * as FiligranIcon from 'filigran-icon'
import React, {Fragment,ReactElement,useState,useMemo} from 'react'
import Popup from './icon-popup';
import SearchBar from './icon-searchbar';

export const DisplayAllIcons = () => {
  const [selectedIcon, setSelectedIcon] = useState<ReactElement | null>(null);
  const [selectedIconLabel, setSelectedIconLabel] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleIconClick = (Icon : React.ComponentType<any> ,icon : string) => {
    setSelectedIcon(<Icon className="w-20 h-20"/>);
    setSelectedIconLabel(icon);
    setIsOpen(true);
  }

  const handleClose = () => {
  setIsOpen(false);
  setSelectedIcon(null);
  setSelectedIconLabel('');
  } 

  const allIcons = Object.keys(FiligranIcon).filter((key) => key !== 'default')

  const filteredIcons = useMemo(() => {
    return allIcons.filter(icon => 
      icon.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allIcons, searchTerm]);
  const getIcon = (icon: string) => {
    // @ts-ignore
    const Icon = FiligranIcon[icon]  as React.ComponentType<any>;
    return <Icon className="h-16 w-16 hover:border-[1px] border-blue rounded-lg"  onClick={() => handleIconClick(Icon,icon)} />
  }
  return (
    <div className='container'>
    <SearchBar 
    value={searchTerm}
    onChange={setSearchTerm}
    placeholder="Search Filigran icons..."
      />
    <div className="grid grid-cols-[repeat(auto-fill,_100px)] gap-4">
      {filteredIcons.map((icon) => (
        <div
          className="flex flex-col items-center"
          key={icon}>
          <div>{getIcon(icon)}</div>
          <label className="text-xs">{icon}</label>
        </div>
      ))}
    </div>
    {isOpen && <Popup icon={selectedIcon} iconName={selectedIconLabel} onClose={handleClose} />}
    </div>
  )
}
