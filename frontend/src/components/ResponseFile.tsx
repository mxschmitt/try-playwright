import React from 'react'

interface ResponseFileProps {
    file: FileWrapper;
}

const ResponseFile: React.FunctionComponent<ResponseFileProps> = ({ file }) => {
    const { publicURL, filename, extension } = file
    return <p style={{ marginBottom: 10 }}>
        {filename}
        {extension === ".pdf" ? <>
            <object type="application/pdf" data={publicURL} style={{
                display: "block",
                width: "100%",
                minHeight: 500
            }} >
                {filename}
            </object>
        </> : extension === ".mp4" ? <>
            <video autoPlay muted style={{ width: "100%" }} controls loop>
                <source src={publicURL} type="video/mp4" />
            </video>
        </> : <>
                    <img src={publicURL} alt={filename} style={{ width: "100%", borderRadius: 4 }} />
                </>}
    </p>
}

export default ResponseFile