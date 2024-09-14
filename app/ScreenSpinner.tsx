import React from "react";

export function ScreenSpinner() {
    return (
        <div className="lds-screen-container">
            <div className="lds-ring">
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>
        </div>
    );
}
