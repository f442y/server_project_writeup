var parser = new DOMParser();
var converter = new showdown.Converter();

// An array of all the sections (ordered)
const sections = [
    "intro_page",
    "setting_up_server_nodes",
    "setting_up_system_architecture",
];

main = async () => {
    fixed_path_images = "/server_project_md/";
    await githubPagesCheck();

    sections.forEach(createDiv)
    sections.forEach(getMDandAppend)
}

createDiv = (section_name) => {
    const newDiv = document.createElement("div");
    newDiv.id = section_name;
    newDiv.classList.add("content");
    document.getElementById("content").appendChild(newDiv);
}

/**
 * To load files on github pages, the server requires the absolute path of the resource,
 * therefore, when the URL is one of "github.io", the fixed path to download the
 * markdown files uses an absolute path which includes the repository name.
 * When using a http server, the fixed path only needs to be relative.
 */
githubPagesCheck = () => {
    const hostname = window.location.hostname.split(".").slice(-2).join(".");
    if (hostname == "github.io") {
        fixed_path_md = `/${window.location.pathname.split("/")[1]}/server_project_md/`;
    } else {
        fixed_path_md = "/server_project_md/";
    }
}

getMDandAppend = async (section_name) => {
    // Fetch the Markdown file in text format
    md_text = await fetchMDfile(fixed_path_md, section_name);

    // While the file is in text format, remove the table of contents (TOC) for the file
    md_text_no_TOC = await removeTOC(md_text);

    // Convert the Markdown text into HTML text
    html_text = await converter.makeHtml(md_text_no_TOC);

    // Convert the HTML text into a HTML document (documentElement)
    html_element = await convertTextToHtmlDocument(html_text);

    // Edit src of img tags in HTML document
    html_element = editImgSrc(html_element, fixed_path_images, section_name);

    addSectionToSidebar(html_element, section_name);

    // Add styling classes to html tags
    html_element = await addClassesToTags(html_element, section_name);

    appendElement(html_element, section_name);
}

fetchMDfile = async (fixed_path_md, section_name) => {
    return await fetch(`${fixed_path_md}${section_name}/${section_name}.md`)
        .then(r => r.text())
        .then(t => {
            return t;
        });
}

/**
 * The markdown files contain an automatically generated table of contents (TOC).
 * To prevent the table from being processed into HTML, it is removed.
 * The markdown file contains a comment to mark the beginning and end of the table.
 * <!-- TOC:start --> and <!-- TOC:end -->
 * All text between these two comments is removed.
 */
removeTOC = async (md_text) => {
    const nregex = new RegExp("<!-- TOC:start -->[\\d\\D]*?\<!-- TOC:end -->", "g");
    return md_text.replace(nregex, "");
}

convertTextToHtmlDocument = (html_text) => {
    return parser.parseFromString(html_text, 'text/html');
}

/**
 * As the src tags of all images in the markdown files are defined relatively, the src 
 * tags need to be redefined to the full path relative to the index.html file.
 */
editImgSrc = (html_element, fixed_path_images, section_name) => {
    html_element.querySelectorAll("img").forEach(img => {
        img.src = img.src.replace("/resources", `${fixed_path_images}${section_name}/resources`);
    })
    return html_element;
}

addSectionToSidebar = (html_element, section_name) => {
    var details_element = document.createElement("details");
    details_element.id = `${section_name}_sidebar`;
    details_element.classList.add("collapse-panel");

    var summary_element = document.createElement("summary");
    summary_element.classList.add("collapse-header");
    summary_element.innerHTML = html_element.getElementsByTagName("h2")[0].innerHTML;


    var content_element = document.createElement("div");
    content_element.id = `${section_name}_sidebar_content`;
    content_element.classList.add("collapse-content")

    details_element.append(summary_element);
    details_element.append(content_element);

    document.getElementById("sidebar-sections").appendChild(details_element);
}

appendElement = (html_element, section_name) => {
    var elements_in_body_list = Array.prototype.slice.call(html_element.body.querySelectorAll('body > *'));
    elements_in_body_list.forEach(element => {
        element.classList.add();
        document.getElementById(section_name).appendChild(element);
    })
}

/**
 * To correctly format the HTML, classes need to be added to the HTML tags, this allows 
 * the correct CSS formatting of the HTML elements.
 */
addClassesToTags = (html_element, section_name) => {
    // Root div of section
    document.getElementById(section_name).classList.add()

    // Individual tags of section
    html_element.querySelectorAll("p").forEach(tag => {
        tag.classList.add();
    });
    html_element.querySelectorAll("h2").forEach(tag => {
        tag.classList.add();
    });
    html_element.querySelectorAll("img").forEach(tag => {
        tag.classList.add("img-fluid", "rounded");
    });
    html_element.querySelectorAll("code").forEach(tag => {
        tag.classList.add("code");
    });
    html_element.querySelectorAll("pre").forEach(tag => {
        tag.classList.add("scroll");
    });
    html_element.querySelectorAll("blockquote").forEach(tag => {
        tag.classList.add("text-muted");
    });
    return html_element;
}

main();