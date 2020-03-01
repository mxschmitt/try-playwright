import React from 'react'

interface ResponseFileProps {
    file: FileWrapper
}

const ResponseFile: React.FunctionComponent<ResponseFileProps> = ({ file }) => {
    const { publicURL, filename, mimetype } = file
    return <p style={{ marginBottom: 10 }}>
        {filename}
        {mimetype === "application/pdf" ? <>
            <object type="application/pdf" data={publicURL} style={{
                display: "block",
                width: "100%",
                minHeight: 500
            }} >
                {filename}
            </object>
        </> : <>
                <img src={publicURL} alt={filename} style={{ width: "100%", borderRadius: 4 }} />
            </>}
    </p>
}

export default ResponseFile