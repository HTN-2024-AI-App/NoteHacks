import React, { useState, ReactNode } from 'react';
import { ChevronRightIcon, ChevronDownIcon } from '@radix-ui/react-icons';


interface CollapsibleHeadingProps {
    heading: string;
    content: React.ReactNode;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

const CollapsibleHeading: React.FC<CollapsibleHeadingProps> = ({ heading, content, isOpen, setIsOpen }) => {
    const toggleOpen = (): void => setIsOpen(!isOpen);

    return (
        <div className="mb-4">
            <div
                className="flex items-center cursor-pointer"
                onClick={toggleOpen}
            >
                {isOpen ? (
                    <ChevronDownIcon className="mr-2" /> 
                ) : (
                    <ChevronRightIcon className="mr-2" />
                )}
                <p className="text-lg font-semibold !py-0">{heading}</p>
            </div>
            {isOpen && (
                <div className="-mt-6 ml-6 -mb-2">
                    {content}
                </div>
            )}
        </div>
    );
};


export default CollapsibleHeading;
